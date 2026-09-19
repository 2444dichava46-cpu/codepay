import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppHeader from "../AppHeader";
import MarkAllReadButton from "@/components/MarkAllReadButton";
import { NOTIFICATION_TYPE_LABELS, formatDateTime } from "@/lib/labels";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: session.sub, read: false } }),
  ]);

  return (
    <div>
      <AppHeader name={session.name} role={session.role} />
      <div className="wrap" style={{ padding: "28px 24px 64px", maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            Notificações {unreadCount > 0 && <span className="badge badge-warn">{unreadCount} não lidas</span>}
          </h1>
          {unreadCount > 0 && <MarkAllReadButton />}
        </div>

        {notifications.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>Nenhuma notificação por enquanto.</p>
        )}

        <div className="card" style={{ padding: 8 }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item notif-page ${n.read ? "" : "unread"}`}
              data-testid="notification-page-item"
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span className="notif-type">{NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}</span>
                <time style={{ fontSize: 12, color: "var(--text-soft)" }}>{formatDateTime(n.createdAt)}</time>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13.5 }}>{n.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
