import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Avatar from "@/components/Avatar";
import AppHeader from "@/app/AppHeader";
import { AVAILABILITY_LABELS, formatBRL, formatDate } from "@/lib/labels";

export default async function DeveloperPublicProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { developerProfile: true },
  });
  if (!user || user.role !== "DEVELOPER" || !user.developerProfile) notFound();
  const profile = user.developerProfile;

  const [completedProjects, reviews] = await Promise.all([
    prisma.project.findMany({
      where: { status: "COMPLETED", contract: { developerId: user.id } },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.review.findMany({
      where: { targetId: user.id },
      include: {
        author: { select: { name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const technologies = profile.technologies.split(",").map((t) => t.trim()).filter(Boolean);
  const specialties = profile.specialties.split(",").map((t) => t.trim()).filter(Boolean);
  const isSelf = session?.sub === user.id;

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

      <div className="wrap" style={{ padding: "28px 24px 64px", maxWidth: 860 }}>
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Avatar src={profile.photoUrl} name={user.name} size={88} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 2px" }} data-testid="developer-name">{user.name}</h1>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 6 }} data-testid="developer-headline">
                {profile.headline || "Programador"}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
                <span data-testid="developer-rating">
                  <span className="stars">{"★".repeat(Math.round(profile.ratingAvg))}</span>
                  <span className="stars-empty">{"★".repeat(5 - Math.round(profile.ratingAvg))}</span>{" "}
                  {profile.ratingAvg.toFixed(1)} · {profile.ratingCount} {profile.ratingCount === 1 ? "avaliação" : "avaliações"}
                </span>
                <span data-testid="developer-availability">
                  {profile.availability ? AVAILABILITY_LABELS[profile.availability] ?? profile.availability : "Disponibilidade não informada"}
                </span>
                {profile.hourlyRate != null && (
                  <span data-testid="developer-hourly-rate">{formatBRL(profile.hourlyRate)} / hora</span>
                )}
                {profile.location && <span>{profile.location}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
              {isSelf ? (
                <Link href="/profile" className="btn btn-outline" data-testid="edit-own-profile-link">Editar perfil</Link>
              ) : session?.role === "CLIENT" ? (
                <>
                  <Link href={`/messages/new?to=${user.id}&intent=hire`} className="btn btn-primary" data-testid="hire-developer-button">Contratar</Link>
                  <Link href={`/messages/new?to=${user.id}`} className="btn btn-outline" data-testid="message-developer-button">Enviar mensagem</Link>
                </>
              ) : session ? (
                <span className="badge badge-muted">Apenas clientes podem contratar</span>
              ) : (
                <Link href="/login" className="btn btn-primary" data-testid="login-to-hire-link">Entrar para contatar</Link>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Sobre</h3>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }} data-testid="developer-bio">
            {profile.bio || "Este programador ainda não escreveu uma bio."}
          </p>
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Tecnologias e especialidades</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }} data-testid="developer-technologies">
            {technologies.length > 0
              ? technologies.map((t) => <span key={t} className="tag">{t}</span>)
              : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Nenhuma tecnologia informada.</span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-testid="developer-specialties">
            {specialties.map((s) => <span key={s} className="tag">{s}</span>)}
          </div>
          {profile.portfolio && (
            <p style={{ marginTop: 12, fontSize: 13.5 }}>
              Portfólio:{" "}
              <a href={profile.portfolio} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontWeight: 600, wordBreak: "break-all" }} data-testid="developer-portfolio-link">
                {profile.portfolio}
              </a>
            </p>
          )}
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Projetos realizados</h3>
          {completedProjects.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>Nenhum projeto concluído ainda.</p>
          )}
          {completedProjects.map((proj) => (
            <div key={proj.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)" }} data-testid="developer-completed-project">
              <span style={{ fontSize: 14, fontWeight: 600 }}>{proj.title}</span>
              <span style={{ fontSize: 12, color: "var(--text-soft)" }}>{formatDate(proj.updatedAt)}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Avaliações recebidas</h3>
          {reviews.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>Nenhuma avaliação ainda.</p>
          )}
          {reviews.map((r) => (
            <div key={r.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }} data-testid="developer-review-item">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong style={{ fontSize: 13.5 }}>{r.project.title}</strong>
                <span className="stars">{"★".repeat(r.rating)}<span className="stars-empty">{"★".repeat(5 - r.rating)}</span></span>
              </div>
              {r.comment && <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 4px" }}>{r.comment}</p>}
              <span style={{ fontSize: 12, color: "var(--text-soft)" }}>{r.author.name} · {formatDate(r.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
