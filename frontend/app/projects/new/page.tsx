"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", description: "", category: "", technologies: "",
    budgetMin: "", budgetMax: "", deadlineDays: "",
  });
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
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          budgetMin: Number(form.budgetMin),
          budgetMax: Number(form.budgetMax),
          deadlineDays: Number(form.deadlineDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível publicar o projeto.");
        return;
      }
      router.push(`/projects/${data.project.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 640, padding: "40px 24px 64px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Publicar novo projeto</h1>
      {error && <div className="error-box">{error}</div>}
      <form onSubmit={onSubmit} className="card" style={{ padding: 24 }}>
        <div className="form-group">
          <label>Título do projeto</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex: Plataforma de e-commerce" required data-testid="new-project-title-input" />
        </div>
        <div className="form-group">
          <label>Descrição</label>
          <textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Descreva seu projeto em detalhes…" required data-testid="new-project-description-input" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Categoria</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} required data-testid="new-project-category-select">
              <option value="">Selecione uma categoria</option>
              <option>Desenvolvimento Web</option>
              <option>Front-end</option>
              <option>Back-end</option>
              <option>Full Stack</option>
              <option>Mobile</option>
              <option>Python</option>
            </select>
          </div>
          <div className="form-group">
            <label>Tecnologias necessárias</label>
            <input value={form.technologies} onChange={(e) => set("technologies", e.target.value)} placeholder="Ex: React, Node.js, PostgreSQL" data-testid="new-project-technologies-input" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Orçamento mínimo (R$)</label>
            <input type="number" min={0} value={form.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} required data-testid="new-project-budget-min-input" />
          </div>
          <div className="form-group">
            <label>Orçamento máximo (R$)</label>
            <input type="number" min={0} value={form.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} required data-testid="new-project-budget-max-input" />
          </div>
        </div>
        <div className="form-group">
          <label>Prazo (dias)</label>
          <input type="number" min={1} value={form.deadlineDays} onChange={(e) => set("deadlineDays", e.target.value)} required data-testid="new-project-deadline-input" />
        </div>
        <button className="btn btn-primary btn-block" disabled={loading} data-testid="publish-project-submit-button">
          {loading ? "Publicando…" : "Publicar projeto"}
        </button>
      </form>
    </div>
  );
}
