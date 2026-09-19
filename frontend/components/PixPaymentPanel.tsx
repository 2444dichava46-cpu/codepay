"use client";

import { useState } from "react";
import { PAYMENT_STATUS_LABELS, formatBRL } from "@/lib/labels";

type PaymentData = {
  amount: number;
  platformFee: number;
  developerAmount: number;
  status: string;
} | null;

export default function PixPaymentPanel({
  contractId,
  payment,
  gatewayConfigured,
  pixKey,
  meIsClient,
}: {
  contractId: string;
  payment: PaymentData;
  gatewayConfigured: boolean;
  pixKey: string;
  meIsClient: boolean;
}) {
  const [pixData, setPixData] = useState<{
    qrCodeBase64?: string;
    qrCode?: string;
    ticketUrl?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generatePix() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });
      const data = await res.json();
      if (data.status === "CONFIGURATION_PENDING") {
        setMessage(data.message);
        return;
      }
      if (!res.ok) {
        setMessage(data.error ?? "Não foi possível gerar a cobrança Pix.");
        return;
      }
      setPixData(data);
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div data-testid="payment-panel">
      {payment ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Valor do contrato</div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{formatBRL(payment.amount)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Comissão Code Pay (10%)</div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{formatBRL(payment.platformFee)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Valor do programador</div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{formatBRL(payment.developerAmount)}</div>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>Nenhum pagamento registrado.</p>
      )}

      {payment && (
        <p style={{ marginBottom: 12 }}>
          <span
            className={`badge ${payment.status === "PENDING" ? "badge-warn" : payment.status === "PAID" || payment.status === "RELEASED" ? "badge-success" : "badge-muted"}`}
            data-testid="payment-status-badge"
          >
            {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
          </span>
        </p>
      )}

      <div className="escrow-box" data-testid="escrow-explainer">
        <strong>Como funciona a retenção (escrow):</strong> o valor pago pelo cliente fica
        retido pela Code Pay e os {formatBRL(payment?.developerAmount ?? 0)} do programador são
        liberados automaticamente quando o cliente aprova a entrega. A liberação só acontece
        depois que o pagamento é efetivamente confirmado — nenhum valor é liberado sem pagamento
        confirmado.
        {payment?.status === "RELEASED" && (
          <div style={{ marginTop: 8, fontWeight: 600 }} data-testid="escrow-released-note">
            Valor já liberado ao programador após a aprovação da entrega.
          </div>
        )}
        {payment?.status === "PAID" && (
          <div style={{ marginTop: 8, fontWeight: 600 }}>
            Pagamento confirmado e retido — será liberado na aprovação da entrega.
          </div>
        )}
      </div>

      {!gatewayConfigured && (
        <div className="warn-box" data-testid="payment-pending-config">
          <strong>Pagamento pendente de configuração.</strong>{" "}
          A integração com o gateway Mercado Pago / Pix será ativada quando a credencial{" "}
          <code>MERCADOPAGO_ACCESS_TOKEN</code> for configurada no ambiente. Enquanto isso, o status
          do pagamento permanece <em>pendente</em> — nenhum pagamento é simulado como concluído.
          {pixKey && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>
                Chave Pix de recebimento da Code Pay (para transferência manual, se o cliente preferir):
              </span>
              <code className="pix-key" data-testid="platform-pix-key">{pixKey}</code>{" "}
              <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={copyKey} data-testid="pix-key-copy-button">
                {copied ? "Copiado!" : "Copiar chave"}
              </button>
            </div>
          )}
        </div>
      )}

      {gatewayConfigured && meIsClient && payment?.status === "PENDING" && !pixData && (
        <button className="btn btn-primary" onClick={generatePix} disabled={loading} data-testid="generate-pix-button">
          {loading ? "Gerando…" : "Gerar cobrança Pix"}
        </button>
      )}

      {pixData?.qrCodeBase64 && (
        <div style={{ marginTop: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code Pix" width={180} data-testid="pix-qr-code" />
        </div>
      )}
      {pixData?.qrCode && (
        <div style={{ marginTop: 10 }}>
          <code className="pix-key" style={{ display: "block", wordBreak: "break-all" }}>{pixData.qrCode}</code>
          <button
            className="btn btn-outline"
            style={{ marginTop: 8, padding: "6px 12px", fontSize: 12.5 }}
            onClick={() => navigator.clipboard.writeText(pixData.qrCode!)}
          >
            Copiar Pix copia-e-cola
          </button>
        </div>
      )}

      {message && <div className="error-box" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
