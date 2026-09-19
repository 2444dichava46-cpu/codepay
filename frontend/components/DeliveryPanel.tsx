"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DELIVERY_STATUS_LABELS, formatDateTime } from "@/lib/labels";

type Delivery = {
  id: string;
  description: string;
  link: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

export default function DeliveryPanel({
  contractId,
  deliveries,
  meIsDeveloper,
  meIsClient,
  contractActive,
}: {
  contractId: string;
  deliveries: Delivery[];
  meIsDeveloper: boolean;
  meIsClient: boolean;
  contractActive: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ description: "", link: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisionFor, setRevisionFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [acting, setActing] = useState(false);

  async function submitDelivery(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível enviar a entrega.");
        return;
      }
      setForm({ description: "", link: "", notes: "" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function approve(deliveryId: string) {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível aprovar a entrega.");
        return;
      }
      router.refresh();
    } finally {
      setActing(false);
    }
  }

  async function requestRevision(deliveryId: string) {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível solicitar a alteração.");
        return;
      }
      setRevisionFor(null);
      setFeedback("");
      router.refresh();
    } finally {
      setActing(false);
    }
  }

  const latestSubmittedId =
    deliveries.find((d) => d.status === "SUBMITTED")?.id ?? null;

  return (
    <div data-testid="delivery-panel">
      {deliveries.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>
          Nenhuma entrega ainda.
          {meIsDeveloper && contractActive && " Envie a primeira entrega quando tiver algo pronto."}
        </p>
      )}

      {deliveries.map((d) => (
        <div key={d.id} className="delivery-item" data-testid="delivery-item">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 14 }}>{d.description}</p>
              {d.link && (
                <a href={d.link} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: 13, wordBreak: "break-all" }} data-testid="delivery-link">
                  {d.link}
                </a>
              )}
              {d.notes && (
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
                  Observações: {d.notes}
                </p>
              )}
              <time style={{ fontSize: 12, color: "var(--text-soft)" }}>{formatDateTime(d.createdAt)}</time>
            </div>
            <span className={`badge ${d.status === "APPROVED" ? "badge-success" : "badge-muted"}`}>
              {DELIVERY_STATUS_LABELS[d.status] ?? d.status}
            </span>
          </div>

          {meIsClient && contractActive && d.status === "SUBMITTED" && (
            <div style={{ marginTop: 12 }}>
              {revisionFor === d.id ? (
                <div>
                  <textarea
                    rows={3}
                    data-testid="delivery-feedback-input"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Descreva o que precisa ser alterado…"
                    style={{ width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13.5 }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => requestRevision(d.id)}
                      disabled={acting || !feedback.trim()}
                      data-testid="delivery-revision-confirm-button"
                    >
                      Confirmar solicitação
                    </button>
                    <button className="btn btn-outline" onClick={() => { setRevisionFor(null); setFeedback(""); }}>
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => approve(d.id)}
                    disabled={acting}
                    data-testid="delivery-approve-button"
                  >
                    {acting ? "Processando…" : "Aprovar entrega"}
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => { setRevisionFor(d.id); setFeedback(""); }}
                    disabled={acting}
                    data-testid="delivery-revision-button"
                  >
                    Solicitar alteração
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {meIsDeveloper && contractActive && (
        <form onSubmit={submitDelivery} style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="form-group">
            <label>Descrição da entrega</label>
            <textarea
              rows={3}
              data-testid="delivery-description-input"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descreva o que foi desenvolvido nesta entrega…"
              required
            />
          </div>
          <div className="form-group">
            <label>Link da entrega (URL)</label>
            <input
              data-testid="delivery-link-input"
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              placeholder="Ex: https://github.com/…"
            />
          </div>
          <div className="form-group">
            <label>Observações</label>
            <input
              data-testid="delivery-notes-input"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Informações adicionais (opcional)"
            />
          </div>
          {latestSubmittedId && (
            <p style={{ fontSize: 12.5, color: "var(--text-soft)", marginTop: -6 }}>
              Já existe uma entrega aguardando aprovação — você ainda pode enviar uma nova versão.
            </p>
          )}
          <button className="btn btn-primary" disabled={submitting} data-testid="delivery-submit-button">
            {submitting ? "Enviando…" : "Enviar entrega"}
          </button>
        </form>
      )}

      {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
