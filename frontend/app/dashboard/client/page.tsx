import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppHeader from "../../AppHeader";
import { PROJECT_STATUS_LABELS, formatBRL, formatDate } from "@/lib/labels";

export default async function ClientDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "CLIENT") redirect("/dashboard");

  const [projects, contractsActive, deliveriesAwaiting, unread] = await Promise.all([
    prisma.project.findMany({
      where: { clientId: session.sub },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { proposals: true } } },
    }),
    prisma.contract.count({ where: { clientId: session.sub, status: "ACTIVE" } }),
    prisma.delivery.count({
      where: { status: "SUBMITTED", project: { clientId: session.sub } },
    }),
    prisma.notification.count({ where: { userId: session.sub, read: false } }),
  ]);

  const stats = [
    { label: "Projetos publicados", value: projects.length },
    { label: "Em andamento", value: projects.filter((p) => p.status === "IN_PROGRESS").length },
    { label: "Propostas recebidas", value: projects.reduce((sum, p) => sum + p._count.proposals, 0) },
    { label: "Concluídos", value: projects.filter((p) => p.status === "COMPLETED").length },
    { label: "Contratos ativos", value: contractsActive },
    { label: "Entregas para aprovar", value: deliveriesAwaiting },
    { label: "Notificações não lidas", value: unread },
  ];

  const statusStyle: Record<string, string> = {
    OPEN: "badge-info",
    IN_PROGRESS: "badge-success",
    COMPLETED: "badge-muted",
    CANCELLED: "badge-muted",
  };

  return (
    <div>
      <AppHeader name={session.name} role={session.role} />
      <div className="wrap" style={{ padding: "28px 24px 64px" }}>
        <h2 style={{ fontSize: 23, fontWeight: 800, marginBottom: 4 }}>Olá, {session.name} 👋</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>Aqui está o resumo dos seus projetos.</p>

        <div className="stat-grid" data-testid="client-dashboard-stats">
          {stats.map((s) => (
            <div className="card" style={{ padding: 18 }} key={s.label} data-testid="client-stat-card">
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <Link href="/projects/new" className="btn btn-primary" data-testid="publish-project-button">+ Publicar novo projeto</Link>
          <Link href="/contracts" className="btn btn-outline" data-testid="dashboard-contracts-link">Ver contratos</Link>
          <Link href="/notifications" className="btn btn-outline" data-testid="dashboard-notifications-link">Notificações</Link>
        </div>

        <div className="card" style={{ padding: 8 }}>
          <div style={{ padding: "10px 12px", fontWeight: 700, fontSize: 15 }}>Meus projetos</div>
          {projects.length === 0 && (
            <p style={{ padding: "0 12px 16px", color: "var(--text-muted)", fontSize: 13.5 }}>
              Você ainda não publicou nenhum projeto.
            </p>
          )}
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h5 style={{ margin: "0 0 3px", fontSize: 14 }}>{p.title}</h5>
                <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
                  {formatBRL(p.budgetMin)} – {formatBRL(p.budgetMax)} · {p.deadlineDays} dias · {p._count.proposals} propostas
                </span>
              </div>
              <span className={`badge ${statusStyle[p.status]}`}>{PROJECT_STATUS_LABELS[p.status]}</span>
            </Link>
          ))}
        </div>

        {projects.length > 0 && (
          <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--text-soft)" }}>
            Última atualização: {formatDate(new Date())}
          </p>
        )}
      </div>
    </div>
  );
}
