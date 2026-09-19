import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function LandingPage() {
  const session = await getSession();
  const recentProjects = await prisma.project.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { _count: { select: { proposals: true } } },
  });

  return (
    <div>
      <header className="wrap site-header">
        <div className="logo"><span className="mark">&lt;/&gt;</span> Code Pay</div>
        <nav style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link href="/projects">Explorar projetos</Link>
          {session ? (
            <Link href="/dashboard" className="btn btn-primary">Meu painel</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline">Entrar</Link>
              <Link href="/register" className="btn btn-primary">Criar conta</Link>
            </>
          )}
        </nav>
      </header>

      <section className="wrap" style={{ padding: "64px 24px" }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em", maxWidth: 640, lineHeight: 1.1 }}>
          Encontre quem transforma código em solução.
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 17, maxWidth: 480, margin: "18px 0 28px" }}>
          Conectamos empresas e pessoas aos melhores profissionais de tecnologia para transformar
          ideias em projetos reais.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/projects" className="btn btn-primary">Encontrar programador</Link>
          <Link
            href={session?.role === "CLIENT" ? "/projects/new" : "/register"}
            className="btn btn-outline"
          >
            Publicar projeto
          </Link>
        </div>
      </section>

      <section className="wrap" style={{ padding: "24px 24px 72px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>Projetos abertos recentemente</h2>
        {recentProjects.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>
            Ainda não há projetos publicados. <Link href="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>Crie uma conta de cliente</Link> e publique o primeiro.
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {recentProjects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card" style={{ padding: 18, display: "block" }}>
              <span className="badge badge-muted">{p.category}</span>
              <h4 style={{ margin: "10px 0 6px", fontSize: 15.5 }}>{p.title}</h4>
              <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                <span>R$ {p.budgetMin} – R$ {p.budgetMax}</span>
                <span>{p._count.proposals} propostas</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
