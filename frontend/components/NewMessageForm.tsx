"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewMessageForm({
  receiverId,
  receiverName,
  prefill,
}: {
  receiverId: string;
  receiverName: string;
  prefill: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState(prefill);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId, content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível enviar a mensagem.");
        return;
      }
      router.push("/messages");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 24 }}>
      <div className="form-group">
        <label>Mensagem para {receiverName}</label>
        <textarea
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva sua mensagem…"
          required
          data-testid="new-message-input"
        />
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={sending} data-testid="new-message-send-button">
        {sending ? "Enviando…" : "Enviar mensagem"}
      </button>
    </form>
  );
}
