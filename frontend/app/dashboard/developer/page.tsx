import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppHeader from "../../AppHeader";
import { PROPOSAL_STATUS_LABELS, formatBRL, formatDateTime } from "@/lib/labels";

export default async function DeveloperDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "DEVELOPER") redirect("/dashboard");

  const [proposals, contracts, deliveriesPending, profile, unread] = await Promise.all([
    prisma.proposal.findMany({
      where: { developerId: session.sub },
      include: { project: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contract.findMany({
      where: { developerId: session.sub },
      include: { project: { select: { id: true, title: true, status: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.delivery.count({ where: { developerId: session.sub, status: "SUBMITTED" } }),
    prisma.developerProfile.findUnique({ where: { userId: session.sub } }),
    prisma.notification.count({ where: { userId: session.sub, read: false } }),
  ]);

  const activeContracts = contracts.filter((c) => c.status === "ACTIVE");
  const completedProjects = contracts.filter(
    (c) => c.project.status === "COMPLETED"
  ).length;

  const recommended = await prisma.project.findMany({
    where: { status: "OPEN", proposals: { none: { developerId: session.sub } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const stats = [
    { label: "Propostas enviadas", value: proposals.length },
    { label: "Propostas aceitas", value: proposals.filter((p) => p.status === "ACCEPTED").length },
    { label: "Contratos ativos", value: activeContracts.length },
    { label: "Projetos concluídos", value: completedProjects },
    { label: "Entregas aguardando aprovação", value: deliveriesPending },
    {
      label: "Nota média",
      value: profile
        ? `${profile.ratingAvg.toFixed(1)} ★ (${profile.ratingCount})`
        : "— (0)",
    },
    { label: "Notificações não lidas", value: unread },
  ];

  return (
    <div>
      <AppHeader name={session.name} role={session.role} />
      <div className="wrap" style={{ padding: "28px 24px 64px" }}>
        <h2 style={{ fontSize: 23, fontWeight: 800, marginBottom: 4 }}>Olá, {session.name} 👋</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>Aqui está um resumo da sua atividade.</p>

        <div className="stat-grid" data-testid="developer-dashboard-stats">
          {stats.map((s) => (
            <div className="card" style={{ padding: 18 }} key={s.label} data-testid="developer-stat-card">
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <Link href="/projects" className="btn btn-primary" data-testid="find-projects-button">Encontrar projetos</Link>
          <Link href="/profile" className="btn btn-outline" data-testid="edit-profile-link">Editar perfil</Link>
          <Link href="/contracts" className="btn btn-outline" data-testid="dashboard-contracts-link">Ver contratos</Link>
          <Link href="/notifications" className="btn btn-outline" data-testid="dashboard-notifications-link">Notificações</Link>
        </div>

        {activeContracts.length > 0 && (
          <div className="card" style={{ padding: 8, marginBottom: 20 }}>
            <div style={{ padding: "10px 12px", fontWeight: 700, fontSize: 15 }}>Contratos em andamento</div>
            {activeContracts.map((c) => (
              <Link key={c.id} href={`/contracts/${c.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }} data-testid="active-contract-link">
                <div>
                  <h5 style={{ margin: "0 0 3px", fontSize: 14 }}>{c.project.title}</h5>
                  <span style={{ fontSize: 12, color: "var(--text-soft)" }}>{formatBRL(c.agreedAmount)} · iniciado em {formatDateTime(c.createdAt)}</span>
                </div>
                <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>Abrir contrato</span>
              </Link>
            ))}
          </div>
        )}

        <div className="card" style={{ padding: 8, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Projetos recomendados</span>
            <Link href="/projects" style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>Ver todos</Link>
          </div>
          {recommended.length === 0 && (
            <p style={{ padding: "0 12px 16px", color: "var(--text-muted)", fontSize: 13.5 }}>
              Nenhum projeto novo no momento — volte mais tarde.
            </p>
          )}
          {recommended.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} style={{ display: "flex", justifyContent: "space-between", padding: 14, borderTop: "1px solid var(--border)" }}>
              <div>
                <h5 style={{ margin: "0 0 3px", fontSize: 14 }}>{p.title}</h5>
                <span style={{ fontSize: 12, color: "var(--text-soft)" }}>{formatBRL(p.budgetMin)} – {formatBRL(p.budgetMax)} · {p.deadlineDays} dias</span>
              </div>
              <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600, alignSelf: "center" }}>Ver projeto</span>
            </Link>
          ))}
        </div>

        <div className="card" style={{ padding: 8 }}>
          <div style={{ padding: "10px 12px", fontWeight: 700, fontSize: 15 }}>Minhas propostas</div>
          {proposals.length === 0 && (
            <p style={{ padding: "0 12px 16px", color: "var(--text-muted)", fontSize: 13.5 }}>
              Você ainda não enviou propostas.
            </p>
          )}
          {proposals.map((pr) => (
            <Link key={pr.id} href={`/projects/${pr.projectId}`} style={{ display: "flex", justifyContent: "space-between", padding: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h5 style={{ margin: "0 0 3px", fontSize: 14 }}>{pr.project.title}</h5>
                <span style={{ fontSize: 12, color: "var(--text-soft)" }}>Sua proposta: {formatBRL(pr.amount)}</span>
              </div>
              <span className={`badge ${pr.status === "ACCEPTED" ? "badge-success" : pr.status === "REJECTED" ? "badge-danger" : "badge-muted"}`}>
                {PROPOSAL_STATUS_LABELS[pr.status]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
