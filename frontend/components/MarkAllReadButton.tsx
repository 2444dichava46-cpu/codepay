"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markAll() {
    setLoading(true);
    try {
      await fetch("/api/notifications", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-outline" onClick={markAll} disabled={loading} data-testid="notifications-page-mark-read-button">
      {loading ? "Marcando…" : "Marcar todas como lidas"}
    </button>
  );
}
