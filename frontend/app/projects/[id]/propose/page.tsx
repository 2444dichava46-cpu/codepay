"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ProposePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [form, setForm] = useState({ amount: "", deadlineDays: "", message: "", experience: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: params.id,
          amount: Number(form.amount),
          deadlineDays: Number(form.deadlineDays),
          message: form.message,
          experience: form.experience,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível enviar a proposta.");
        return;
      }
      router.push(`/projects/${params.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 560, padding: "40px 24px 64px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Enviar proposta para este projeto</h1>
      {error && <div className="error-box">{error}</div>}
      <form onSubmit={onSubmit} className="card" style={{ padding: 24 }}>
        <div className="form-row">
          <div className="form-group">
            <label>Valor da proposta (R$)</label>
            <input type="number" min={0} value={form.amount} onChange={(e) => set("amount", e.target.value)} required data-testid="proposal-amount-input" />
          </div>
          <div className="form-group">
            <label>Prazo de entrega (dias)</label>
            <input type="number" min={1} value={form.deadlineDays} onChange={(e) => set("deadlineDays", e.target.value)} required data-testid="proposal-deadline-input" />
          </div>
        </div>
        <div className="form-group">
          <label>Mensagem</label>
          <textarea rows={5} value={form.message} onChange={(e) => set("message", e.target.value)}
            placeholder="Explique sua experiência, como pretende desenvolver o projeto e por que você é a melhor escolha." required data-testid="proposal-message-input" />
        </div>
        <div className="form-group">
          <label>Experiência relacionada</label>
          <input value={form.experience} onChange={(e) => set("experience", e.target.value)} placeholder="Ex: 5 anos de experiência com React e Node.js" data-testid="proposal-experience-input" />
        </div>
        <button className="btn btn-primary btn-block" disabled={loading} data-testid="send-proposal-submit-button">
          {loading ? "Enviando…" : "Enviar proposta"}
        </button>
      </form>
    </div>
  );
}
