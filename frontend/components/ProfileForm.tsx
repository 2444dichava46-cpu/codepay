"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";

type ProfileData = {
  name: string;
  email: string;
  photoUrl: string | null;
  headline: string;
  bio: string;
  location: string;
  availability: string;
  hourlyRate: string;
  technologies: string;
  specialties: string;
  portfolio: string;
};

export default function ProfileForm({
  initial,
}: {
  initial: ProfileData;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.photoUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof ProfileData>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/profile/photo", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível enviar a foto.");
        return;
      }
      setPhotoPreview(data.url);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          photoUrl: photoPreview,
          hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o perfil.");
        return;
      }
      setSuccess("Perfil salvo com sucesso!");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 24 }} data-testid="profile-form">
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        <Avatar src={photoPreview} name={form.name || "Programador"} size={72} />
        <div>
          <div className="form-group" style={{ marginBottom: 6 }}>
            <label style={{ marginBottom: 4 }}>Foto de perfil</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPhoto(file);
              }}
              style={{ fontSize: 12.5 }}
              data-testid="profile-photo-input"
            />
          </div>
          {uploading && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Enviando foto…</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Nome</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required data-testid="profile-name-input" />
        </div>
        <div className="form-group">
          <label>Título profissional</label>
          <input value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Ex: Full Stack Developer" data-testid="profile-headline-input" />
        </div>
      </div>

      <div className="form-group">
        <label>Descrição / bio</label>
        <textarea rows={4} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Conte sobre sua experiência e como você trabalha…" data-testid="profile-bio-input" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Localização</label>
          <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Ex: São Paulo, SP" data-testid="profile-location-input" />
        </div>
        <div className="form-group">
          <label>Disponibilidade</label>
          <select value={form.availability} onChange={(e) => set("availability", e.target.value)} data-testid="profile-availability-select">
            <option value="">Selecione…</option>
            <option value="available">Disponível para trabalho</option>
            <option value="busy">Ocupado no momento</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Valor por hora (R$)</label>
          <input type="number" min={0} step="0.01" value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} placeholder="Ex: 120" data-testid="profile-hourly-rate-input" />
        </div>
        <div className="form-group">
          <label>Portfólio (URL)</label>
          <input value={form.portfolio} onChange={(e) => set("portfolio", e.target.value)} placeholder="Ex: https://seuportfolio.dev" data-testid="profile-portfolio-input" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Tecnologias (separadas por vírgula)</label>
          <input value={form.technologies} onChange={(e) => set("technologies", e.target.value)} placeholder="Ex: React, Node.js, PostgreSQL" data-testid="profile-technologies-input" />
        </div>
        <div className="form-group">
          <label>Especialidades (separadas por vírgula)</label>
          <input value={form.specialties} onChange={(e) => set("specialties", e.target.value)} placeholder="Ex: Desenvolvimento Web, APIs e Integrações" data-testid="profile-specialties-input" />
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box" data-testid="profile-save-success">{success}</div>}
      <button className="btn btn-primary btn-block" disabled={saving || uploading} data-testid="profile-save-button">
        {saving ? "Salvando…" : "Salvar perfil"}
      </button>
    </form>
  );
}
