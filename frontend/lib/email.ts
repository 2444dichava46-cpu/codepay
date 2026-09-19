// Code Pay — transactional email through Emergent's managed integration.
//
// Design rules (do not weaken):
//  - Recipients come from server-side DB records; bodies come from the fixed
//    templates below. No caller ever supplies a recipient, subject or HTML.
//  - Every send passes through assertSafeEmail() (structural G2/G3 gate).
//  - Sends are fail-safe: a provider error is logged and swallowed so it can
//    never break the API request that triggered it.

const EMAIL_BASE_URL = "https://integrations.emergentagent.com"; // constant on purpose

const CRED_ASK = [
  "reply with your password", "reply with the code", "send your password", "cvv",
  "send us your password", "enter your password below", "confirm your card number",
  "your full card number", "seed phrase", "recovery phrase", "verify your card",
  "social security number", "confirm your bank details",
  // pt-BR equivalents
  "responda com sua senha", "envie sua senha", "informe sua senha abaixo",
  "confirme o número do seu cartão", "frase de recuperação", "código de segurança do cartão",
];
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly"];
const HOSTISH = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})/gi;

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&period;/gi, ".");
}

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":") || /^\[.*\]$/.test(host); // IPv6 forms
}

function hostOk(host: string): boolean {
  if (!host || host.includes("xn--")) return false;
  if (isIpLiteral(host)) return false;
  return !SHORTENERS.some((s) => host === s || host.endsWith("." + s));
}

function sameSite(shown: string, real: string): boolean {
  return shown === real || real.endsWith("." + shown) || shown.endsWith("." + real);
}

/** Structural defence-in-depth for G2 (no credential asks/forms) and G3 (link hygiene). */
export function assertSafeEmail(subject: string, html: string): void {
  if (/<\s*(form|input|textarea|select)\b/i.test(html)) {
    throw new Error("No forms or input fields in email (G2)");
  }
  const body = `${subject}\n${html}`.toLowerCase();
  for (const phrase of CRED_ASK) {
    if (body.includes(phrase)) {
      throw new Error(`Email asks the recipient for credentials: ${phrase} (G2)`);
    }
  }

  // every href and src must be absolute https (or a safe scheme)
  const urlRe = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(html)) !== null) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    const low = raw.toLowerCase();
    if (low.startsWith("mailto:") || low.startsWith("tel:") || low.startsWith("cid:") || low.startsWith("#")) {
      continue;
    }
    if (!low.startsWith("https://")) {
      throw new Error(`Email links/assets must be absolute https: ${raw} (G3)`);
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(`Unparseable URL in email: ${raw} (G3)`);
    }
    if (!hostOk(parsed.hostname) || parsed.username) {
      throw new Error(`Shortened, numeric-host or credential-bearing URL: ${raw} (G3)`);
    }
  }

  // anchor text must not name a host outside the real href host
  const anchorRe = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    const text = decodeEntities(m[4].replace(/<[^>]*>/g, ""));
    let real = "";
    try {
      real = new URL(href).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!real) continue;
    HOSTISH.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = HOSTISH.exec(text)) !== null) {
      if (!sameSite(hm[1].toLowerCase(), real)) {
        throw new Error(`Anchor text ${hm[1]} != real link host ${real} (G3)`);
      }
    }
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMERGENT_EMAIL_KEY && process.env.EMAIL_FROM_NAME);
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
}

/**
 * Outbound queue. Emails are NEVER sent inside the request path: the route
 * handler enqueues and returns immediately, so a slow or rate-limited provider
 * can never add latency to (or break) the user's action. The worker drains the
 * queue serially with a minimum gap between sends, which keeps us under the
 * provider's burst limit, and retries a 429 once after a longer pause.
 */
const MIN_GAP_MS = 800;
const RETRY_AFTER_MS = 5000;

type QueuedEmail = { to: string; subject: string; html: string; attempt: number };
const queue: QueuedEmail[] = [];
let draining = false;

async function deliver(item: QueuedEmail): Promise<"sent" | "retry" | "failed"> {
  const payload: Record<string, unknown> = {
    to: [item.to],
    subject: item.subject,
    html: item.html,
    from_name: process.env.EMAIL_FROM_NAME, // REQUIRED on every send
  };
  if (process.env.EMAIL_REPLY_TO) payload.contact_email = process.env.EMAIL_REPLY_TO;

  try {
    const res = await fetch(`${EMAIL_BASE_URL}/api/v1/email/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Email-Key": process.env.EMERGENT_EMAIL_KEY as string,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      console.log("Email sent:", data.id ?? "(no id)", "->", item.to);
      return "sent";
    }
    const body = await res.text().catch(() => "");
    if (res.status === 429 && item.attempt === 0) {
      console.warn("Email rate limited, will retry once:", item.to);
      return "retry";
    }
    console.error("Email send failed:", res.status, body);
    return "failed";
  } catch (error) {
    console.error("Email send error:", error);
    return "failed";
  }
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const item = queue.shift() as QueuedEmail;
      const outcome = await deliver(item);
      if (outcome === "retry") {
        await new Promise((r) => setTimeout(r, RETRY_AFTER_MS));
        queue.push({ ...item, attempt: item.attempt + 1 });
      }
      await new Promise((r) => setTimeout(r, MIN_GAP_MS));
    }
  } finally {
    draining = false;
  }
}

/**
 * Enqueue a templated email. Returns immediately (fire-and-forget) — callers
 * never await network I/O. Content always comes from the templates below.
 */
function sendEmail(opts: { to: string; subject: string; html: string }): void {
  if (!isEmailConfigured()) {
    console.warn("Email not configured (EMERGENT_EMAIL_KEY/EMAIL_FROM_NAME) — skipping send.");
    return;
  }
  try {
    assertSafeEmail(opts.subject, opts.html); // G2/G3 gate — never skip
  } catch (error) {
    console.error("Email blocked by safety gate:", error);
    return;
  }
  queue.push({ ...opts, attempt: 0 });
  void drain(); // background worker; intentionally not awaited
}

function layout(heading: string, paragraphs: string[], cta: { href: string; label: string } | null): string {
  const brand = escapeHtml(process.env.EMAIL_FROM_NAME ?? "Code Pay");
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#0F172A">${p}</p>`)
    .join("");
  const button = cta
    ? `<p style="margin:22px 0 0"><a href="${cta.href}" style="background:#4F46E5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E2E8F0;border-radius:14px">
      <tr><td style="padding:26px 28px;font-family:Arial,Helvetica,sans-serif">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#4F46E5;letter-spacing:.04em">${brand.toUpperCase()}</p>
        <h1 style="margin:0 0 16px;font-size:19px;color:#0F172A">${escapeHtml(heading)}</h1>
        ${body}
        ${button}
        <p style="margin:24px 0 0;font-size:12px;color:#94A3B8;line-height:1.6">
          Enviado por ${brand} — mais que código, é oportunidade.<br />
          Nunca pedimos sua senha ou dados do seu cartão por e-mail.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

// ---------------------------------------------------------------------------
// Templates. Each takes IDs/records already loaded server-side.
// ---------------------------------------------------------------------------

export async function emailNewProposal(args: {
  to: string;
  clientName: string;
  developerName: string;
  projectTitle: string;
  projectId: string;
  amountLabel: string;
}) {
  const href = `${appUrl()}/projects/${encodeURIComponent(args.projectId)}`;
  return sendEmail({
    to: args.to,
    subject: `Nova proposta para "${args.projectTitle}"`,
    html: layout(
      "Você recebeu uma nova proposta",
      [
        `Olá ${escapeHtml(args.clientName)}, o programador <strong>${escapeHtml(args.developerName)}</strong> enviou uma proposta para o seu projeto <strong>${escapeHtml(args.projectTitle)}</strong>.`,
        `Valor proposto: <strong>${escapeHtml(args.amountLabel)}</strong>.`,
        "Acesse o projeto para comparar as propostas e escolher o programador.",
      ],
      { href, label: "Ver propostas" }
    ),
  });
}

export async function emailNewMessage(args: {
  to: string;
  recipientName: string;
  senderName: string;
  projectTitle: string;
  contractId: string | null;
}) {
  const href = args.contractId
    ? `${appUrl()}/contracts/${encodeURIComponent(args.contractId)}`
    : `${appUrl()}/messages`;
  return sendEmail({
    to: args.to,
    subject: `Nova mensagem de ${args.senderName}`,
    html: layout(
      "Você tem uma nova mensagem",
      [
        `Olá ${escapeHtml(args.recipientName)}, <strong>${escapeHtml(args.senderName)}</strong> te enviou uma mensagem${args.projectTitle ? ` sobre <strong>${escapeHtml(args.projectTitle)}</strong>` : ""}.`,
        "Abra a conversa na plataforma para responder.",
      ],
      { href, label: "Abrir conversa" }
    ),
  });
}

export async function emailNewDelivery(args: {
  to: string;
  clientName: string;
  developerName: string;
  projectTitle: string;
  contractId: string;
}) {
  const href = `${appUrl()}/contracts/${encodeURIComponent(args.contractId)}`;
  return sendEmail({
    to: args.to,
    subject: `Nova entrega em "${args.projectTitle}"`,
    html: layout(
      "Uma entrega está aguardando sua aprovação",
      [
        `Olá ${escapeHtml(args.clientName)}, <strong>${escapeHtml(args.developerName)}</strong> enviou uma entrega para o projeto <strong>${escapeHtml(args.projectTitle)}</strong>.`,
        "Revise o material e escolha entre aprovar a entrega ou solicitar alterações.",
      ],
      { href, label: "Revisar entrega" }
    ),
  });
}

export async function emailDeliveryApproved(args: {
  to: string;
  developerName: string;
  projectTitle: string;
  contractId: string;
  developerAmountLabel: string;
  released: boolean;
}) {
  const href = `${appUrl()}/contracts/${encodeURIComponent(args.contractId)}`;
  return sendEmail({
    to: args.to,
    subject: `Entrega aprovada em "${args.projectTitle}"`,
    html: layout(
      "Sua entrega foi aprovada",
      [
        `Parabéns ${escapeHtml(args.developerName)}! O cliente aprovou sua entrega no projeto <strong>${escapeHtml(args.projectTitle)}</strong>.`,
        args.released
          ? `Seu valor de <strong>${escapeHtml(args.developerAmountLabel)}</strong> foi liberado.`
          : `Seu valor de <strong>${escapeHtml(args.developerAmountLabel)}</strong> será liberado assim que o pagamento do cliente for confirmado.`,
        "Acesse o contrato para acompanhar os detalhes.",
      ],
      { href, label: "Ver contrato" }
    ),
  });
}

export async function emailRevisionRequested(args: {
  to: string;
  developerName: string;
  projectTitle: string;
  contractId: string;
}) {
  const href = `${appUrl()}/contracts/${encodeURIComponent(args.contractId)}`;
  return sendEmail({
    to: args.to,
    subject: `Alteração solicitada em "${args.projectTitle}"`,
    html: layout(
      "O cliente solicitou alterações",
      [
        `Olá ${escapeHtml(args.developerName)}, o cliente pediu ajustes na sua entrega do projeto <strong>${escapeHtml(args.projectTitle)}</strong>.`,
        "Abra o contrato para ler o pedido no chat e enviar uma nova versão.",
      ],
      { href, label: "Ver solicitação" }
    ),
  });
}
