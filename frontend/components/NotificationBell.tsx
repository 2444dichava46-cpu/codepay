"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NOTIFICATION_TYPE_LABELS, formatDateTime } from "@/lib/labels";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      // offline / logged out — the bell simply stays quiet
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    await fetch("/api/notifications", { method: "POST" });
    load();
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="notif-bell"
        data-testid="notifications-bell-button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificações"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="notif-count" data-testid="notifications-unread-count">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" data-testid="notifications-dropdown">
          <div className="notif-head">
            <strong>Notificações</strong>
            {unread > 0 && (
              <button className="link-btn" onClick={markAll} data-testid="notifications-mark-read-button">
                Marcar todas como lidas
              </button>
            )}
          </div>
          {items.length === 0 && (
            <p className="notif-empty">Nenhuma notificação por enquanto.</p>
          )}
          {items.slice(0, 8).map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.read ? "" : "unread"}`}
              data-testid="notification-item"
            >
              <span className="notif-type">{NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}</span>
              <p>{n.message}</p>
              <time>{formatDateTime(n.createdAt)}</time>
            </div>
          ))}
          {items.length > 0 && (
            <Link href="/notifications" className="notif-all" onClick={() => setOpen(false)}>
              Ver todas
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
