"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProjectOwnerActions({
  projectId,
  canEdit,
  canCancel,
}: {
  projectId: string;
  canEdit: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("Cancelar este projeto? Esta ação não pode ser desfeita.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível cancelar o projeto.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canEdit && (
          <Link href={`/projects/${projectId}/edit`} className="btn btn-outline" data-testid="edit-project-link">
            Editar projeto
          </Link>
        )}
        {canCancel && (
          <button
            className="btn btn-outline"
            onClick={cancel}
            disabled={loading}
            data-testid="cancel-project-button"
          >
            {loading ? "Cancelando…" : "Cancelar projeto"}
          </button>
        )}
      </div>
    </div>
  );
}
