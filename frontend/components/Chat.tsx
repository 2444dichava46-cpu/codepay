"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/labels";

type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  sender: { id: string; name: string };
  createdAt: string;
};

export default function Chat({
  contractId,
  meId,
}: {
  contractId: string;
  meId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${contractId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      // keep the last rendered history on transient failures
    }
  }, [contractId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível enviar a mensagem.");
        return;
      }
      setContent("");
      setMessages((prev) => [...prev, data.message]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat" data-testid="contract-chat">
      <div className="chat-thread">
        {messages.length === 0 && (
          <p className="chat-empty">Nenhuma mensagem ainda. Envie a primeira!</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-row ${m.senderId === meId ? "mine" : ""}`}
            data-testid="chat-message"
          >
            <div className="chat-bubble">
              <span className="chat-sender">
                {m.senderId === meId ? "Você" : m.sender.name}
              </span>
              <p>{m.content}</p>
              <time>{formatDateTime(m.createdAt)}</time>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && <div className="error-box">{error}</div>}
      <form className="chat-composer" onSubmit={send}>
        <input
          data-testid="chat-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva uma mensagem…"
          aria-label="Mensagem"
        />
        <button
          className="btn btn-primary"
          disabled={sending || !content.trim()}
          data-testid="chat-send-button"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
