"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/labels";

export default function EditProjectForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: {
    title: string;
    description: string;
    category: string;
    technologies: string;
    budgetMin: string;
    budgetMax: string;
    deadlineDays: string;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
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
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          technologies: form.technologies,
          budgetMin: Number(form.budgetMin),
          budgetMax: Number(form.budgetMax),
          deadlineDays: Number(form.deadlineDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o projeto.");
        return;
      }
      router.push(`/projects/${projectId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 24 }}>
      <div className="form-group">
        <label>Título do projeto</label>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} required data-testid="edit-project-title-input" />
      </div>
      <div className="form-group">
        <label>Descrição</label>
        <textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} required data-testid="edit-project-description-input" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Categoria</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)} required data-testid="edit-project-category-select">
            <option value="">Selecione uma categoria</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Tecnologias necessárias</label>
          <input value={form.technologies} onChange={(e) => set("technologies", e.target.value)} data-testid="edit-project-technologies-input" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Orçamento mínimo (R$)</label>
          <input type="number" min={0} value={form.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} required data-testid="edit-project-budget-min-input" />
        </div>
        <div className="form-group">
          <label>Orçamento máximo (R$)</label>
          <input type="number" min={0} value={form.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} required data-testid="edit-project-budget-max-input" />
        </div>
      </div>
      <div className="form-group">
        <label>Prazo (dias)</label>
        <input type="number" min={1} value={form.deadlineDays} onChange={(e) => set("deadlineDays", e.target.value)} required data-testid="edit-project-deadline-input" />
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={loading} data-testid="edit-project-submit-button">
        {loading ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
