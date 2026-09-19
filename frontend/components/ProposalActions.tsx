"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProposalActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading("accept");
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível aceitar a proposta.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function reject() {
    if (!window.confirm("Rejeitar esta proposta?")) return;
    setLoading("reject");
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/reject`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível rejeitar a proposta.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={accept}
          disabled={loading !== null}
          data-testid="accept-proposal-button"
        >
          {loading === "accept" ? "Aceitando…" : "Aceitar proposta"}
        </button>
        <button
          className="btn btn-outline"
          onClick={reject}
          disabled={loading !== null}
          data-testid="reject-proposal-button"
        >
          {loading === "reject" ? "Rejeitando…" : "Rejeitar proposta"}
        </button>
      </div>
    </div>
  );
}
