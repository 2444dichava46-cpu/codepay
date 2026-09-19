import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { prisma } from "@/lib/db";

function validSignature(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  const sig = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    sig.split(",").map((x) => x.trim().split("=") as [string, string])
  );
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  } catch {
    return false;
  }
}

// POST /api/webhooks/mercadopago — payment status notifications.
// Only a signature-verified webhook backed by a real Mercado Pago lookup can
// move a Payment out of PENDING. There is no client-side shortcut.
export async function POST(req: NextRequest) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "not_configured", message: "Gateway de pagamento pendente de configuração." },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const bodyJson = await req.json().catch(() => ({}));
  const dataId = String(bodyJson?.data?.id ?? url.searchParams.get("data.id") ?? "");
  if (bodyJson?.type !== "payment" || !dataId) {
    return NextResponse.json({ ok: true });
  }
  if (!validSignature(req, dataId)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    const mp = new Payment(new MercadoPagoConfig({ accessToken: token }));
    const remote = await mp.get({ id: dataId });
    const status =
      remote.status === "approved"
        ? "PAID"
        : ["cancelled", "rejected", "refunded", "charged_back"].includes(remote.status ?? "")
          ? "FAILED"
          : "PENDING";
    await prisma.payment.updateMany({
      where: { externalPaymentId: dataId },
      data: { status },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mercado Pago webhook lookup failed", error);
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
}
