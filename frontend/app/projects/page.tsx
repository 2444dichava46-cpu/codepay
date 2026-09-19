import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NotificationBell from "@/components/NotificationBell";
import AppHeader from "@/app/AppHeader";
import { CATEGORIES, PROJECT_STATUS_LABELS, formatBRL } from "@/lib/labels";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    category?: string;
    tech?: string;
    budgetMin?: string;
    budgetMax?: string;
    deadline?: string;
    status?: string;
  };
}) {
  const session = await getSession();
  const q = searchParams.q?.trim();
  const category = searchParams.category?.trim();
  const tech = searchParams.tech?.trim();
  const budgetMin = Number(searchParams.budgetMin);
  const budgetMax = Number(searchParams.budgetMax);
  const deadline = Number(searchParams.deadline);
  const status = searchParams.status?.trim() || "OPEN";

  const where: Prisma.ProjectWhereInput = {
    ...(status === "ALL" ? {} : { status }),
    ...(category ? { category } : {}),
    ...(tech ? { technologies: { contains: tech } } : {}),
    ...(Number.isFinite(budgetMin) && searchParams.budgetMin
      ? { budgetMax: { gte: budgetMin } }
      : {}),
    ...(Number.isFinite(budgetMax) && searchParams.budgetMax
      ? { budgetMin: { lte: budgetMax } }
      : {}),
    ...(Number.isFinite(deadline) && searchParams.deadline
      ? { deadlineDays: { lte: deadline } }
      : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] } : {}),
  };

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } }, _count: { select: { proposals: true } } },
  });

  return (
    <div>
      {session ? (
        <AppHeader name={session.name} role={session.role} />
      ) : (
        <header className="wrap site-header">
          <Link href="/" className="logo"><span className="mark">&lt;/&gt;</span> Code Pay</Link>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/login" className="btn btn-outline">Entrar</Link>
            <Link href="/register" className="btn btn-primary">Criar conta</Link>
          </div>
        </header>
      )}

      <div className="wrap" style={{ padding: "28px 24px 64px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>Explorar projetos</h1>

        <form className="card filters" style={{ padding: 16, marginBottom: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }} data-testid="project-filter-form">
          <input name="q" defaultValue={q} placeholder="Buscar por título ou descrição…" style={{ gridRow: "span 2" }} data-testid="project-search-input" />
          <select name="category" defaultValue={category ?? ""} data-testid="project-filter-category">
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="status" defaultValue={status} data-testid="project-filter-status">
            <option value="OPEN">Em aberto</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluído</option>
            <option value="ALL">Todos os status</option>
          </select>
          <input name="tech" defaultValue={tech} placeholder="Tecnologia (ex: React)" data-testid="project-filter-tech" />
          <input name="budgetMin" type="number" min={0} defaultValue={searchParams.budgetMin} placeholder="Orçamento mín. (R$)" data-testid="project-filter-budget-min" />
          <input name="budgetMax" type="number" min={0} defaultValue={searchParams.budgetMax} placeholder="Orçamento máx. (R$)" data-testid="project-filter-budget-max" />
          <input name="deadline" type="number" min={1} defaultValue={searchParams.deadline} placeholder="Prazo máx. (dias)" data-testid="project-filter-deadline" />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} data-testid="project-filter-submit">Filtrar</button>
            <Link href="/projects" className="btn btn-outline">Limpar</Link>
          </div>
        </form>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card" style={{ padding: 18, display: "block" }} data-testid="project-card">
              <span className="badge badge-muted">{p.category}</span>
              <h4 style={{ margin: "10px 0 6px", fontSize: 15.5 }}>{p.title}</h4>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px" }}>Cliente: {p.client.name}</p>
              <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>{formatBRL(p.budgetMin)} – {formatBRL(p.budgetMax)}</span>
                <span>{p._count.proposals} propostas</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <span className={`badge ${p.status === "OPEN" ? "badge-info" : p.status === "IN_PROGRESS" ? "badge-success" : "badge-muted"}`}>
                  {PROJECT_STATUS_LABELS[p.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {projects.length === 0 && <p style={{ color: "var(--text-muted)" }}>Nenhum projeto encontrado.</p>}
      </div>
    </div>
  );
}
