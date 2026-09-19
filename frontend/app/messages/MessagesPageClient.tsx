"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "../AppHeader";
import { formatDateTime } from "@/lib/labels";

type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
  sender: { id: string; name: string };
  receiver: { id: string; name: string };
};

type Conversation = {
  userId: string;
  name: string;
  last: Message;
  unread: number;
};

export default function MessagesPage({ meId, meName, meRole }: { meId: string; meName: string; meRole: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      // transient — keep current view
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const conversations = useMemo<Conversation[]>(() => {
    const map = new Map<string, Conversation>();
    for (const m of messages) {
      const other = m.senderId === meId ? m.receiver : m.sender;
      const otherId = other.id;
      const existing = map.get(otherId);
      const unreadInc = m.receiverId === meId && !m.read ? 1 : 0;
      if (!existing) {
        map.set(otherId, { userId: otherId, name: other.name, last: m, unread: unreadInc });
      } else {
        existing.unread += unreadInc;
        // messages arrive ascending; the later one wins
        if (new Date(m.createdAt) >= new Date(existing.last.createdAt)) {
          existing.last = m;
        }
      }
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime()
    );
  }, [messages, meId]);

  const thread = useMemo(
    () =>
      selected
        ? messages.filter(
            (m) =>
              (m.senderId === meId && m.receiverId === selected) ||
              (m.senderId === selected && m.receiverId === meId)
          )
        : [],
    [messages, selected, meId]
  );

  const selectedName = conversations.find((c) => c.userId === selected)?.name ?? "Conversa";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !content.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selected, content: content.trim() }),
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
    <div>
      <AppHeader name={meName} role={meRole} />
      <div className="wrap" style={{ padding: "28px 24px 64px", maxWidth: 900 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>Mensagens</h1>

        {conversations.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            Nenhuma conversa ainda. Você pode iniciar uma pelo perfil público de um programador
            ou pelo chat do contrato.
          </p>
        ) : (
          <div className="messages-layout">
            <div className="card messages-list" style={{ padding: 8 }}>
              {conversations.map((c) => (
                <button
                  key={c.userId}
                  className={`conv-item ${selected === c.userId ? "active" : ""}`}
                  onClick={() => setSelected(c.userId)}
                  data-testid="messages-conversation-item"
                >
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span className="conv-preview">{c.last.content.slice(0, 42)}…</span>
                  {c.unread > 0 && <span className="notif-count">{c.unread}</span>}
                </button>
              ))}
            </div>

            <div className="card messages-thread-wrap" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 10 }}>{selectedName}</div>
              <div className="chat-thread" data-testid="messages-thread">
                {thread.map((m) => (
                  <div key={m.id} className={`chat-row ${m.senderId === meId ? "mine" : ""}`} data-testid="direct-message">
                    <div className="chat-bubble">
                      <span className="chat-sender">{m.senderId === meId ? "Você" : m.sender.name}</span>
                      <p>{m.content}</p>
                      <time>{formatDateTime(m.createdAt)}</time>
                    </div>
                  </div>
                ))}
                {thread.length === 0 && (
                  <p className="chat-empty">Inicie a conversa com uma mensagem.</p>
                )}
              </div>
              {error && <div className="error-box">{error}</div>}
              <form className="chat-composer" onSubmit={send}>
                <input
                  data-testid="messages-input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escreva uma mensagem…"
                  aria-label="Mensagem"
                />
                <button className="btn btn-primary" disabled={sending || !content.trim()} data-testid="messages-send-button">
                  Enviar
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
