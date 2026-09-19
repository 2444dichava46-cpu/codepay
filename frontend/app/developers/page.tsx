import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Avatar from "@/components/Avatar";
import AppHeader from "@/app/AppHeader";
import { AVAILABILITY_LABELS, formatBRL } from "@/lib/labels";

// Public showcase of developer profiles (visible without login).
export default async function DevelopersShowcasePage({
  searchParams,
}: {
  searchParams: {
    tech?: string;
    minRating?: string;
    maxRate?: string;
    availability?: string;
  };
}) {
  const session = await getSession();
  const tech = searchParams.tech?.trim();
  const minRating = Number(searchParams.minRating);
  const maxRate = Number(searchParams.maxRate);
  const availability = searchParams.availability?.trim();

  const where: Prisma.DeveloperProfileWhereInput = {
    ...(tech ? { technologies: { contains: tech } } : {}),
    ...(searchParams.minRating && Number.isFinite(minRating)
      ? { ratingAvg: { gte: minRating } }
      : {}),
    ...(searchParams.maxRate && Number.isFinite(maxRate)
      ? { hourlyRate: { lte: maxRate } }
      : {}),
    ...(availability ? { availability } : {}),
  };

  const profiles = await prisma.developerProfile.findMany({
    where,
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: 60,
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
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Programadores na Code Pay</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 20, fontSize: 13.5 }}>
          Encontre profissionais por tecnologia, avaliação e valor por hora.
        </p>

        <form
          className="card filters"
          style={{ padding: 16, marginBottom: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}
          data-testid="developer-filter-form"
        >
          <input name="tech" defaultValue={tech} placeholder="Tecnologia (ex: React)" data-testid="developer-filter-tech" />
          <select name="minRating" defaultValue={searchParams.minRating ?? ""} data-testid="developer-filter-rating">
            <option value="">Qualquer avaliação</option>
            <option value="4.5">4,5+ estrelas</option>
            <option value="4">4+ estrelas</option>
            <option value="3">3+ estrelas</option>
          </select>
          <input name="maxRate" type="number" min={0} defaultValue={searchParams.maxRate} placeholder="Valor/hora até (R$)" data-testid="developer-filter-rate" />
          <select name="availability" defaultValue={availability ?? ""} data-testid="developer-filter-availability">
            <option value="">Qualquer disponibilidade</option>
            <option value="available">Disponível para trabalho</option>
            <option value="busy">Ocupado no momento</option>
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} data-testid="developer-filter-submit">Filtrar</button>
            <Link href="/developers" className="btn btn-outline">Limpar</Link>
          </div>
        </form>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {profiles.map((p) => {
            const techs = p.technologies.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4);
            return (
              <Link
                key={p.id}
                href={`/developers/${p.user.id}`}
                className="card"
                style={{ padding: 18, display: "block" }}
                data-testid="developer-card"
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                  <Avatar src={p.photoUrl} name={p.user.name} size={48} />
                  <div>
                    <h4 style={{ margin: "0 0 2px", fontSize: 15 }} data-testid="developer-card-name">{p.user.name}</h4>
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                      {p.headline || "Programador"}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 13, marginBottom: 10 }}>
                  <span className="stars">{"★".repeat(Math.round(p.ratingAvg))}</span>
                  <span className="stars-empty">{"★".repeat(5 - Math.round(p.ratingAvg))}</span>{" "}
                  {p.ratingAvg.toFixed(1)} · {p.ratingCount} {p.ratingCount === 1 ? "avaliação" : "avaliações"}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {techs.map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)" }}>
                  <span>{p.hourlyRate != null ? `${formatBRL(p.hourlyRate)}/h` : "Valor a combinar"}</span>
                  <span>{p.availability ? AVAILABILITY_LABELS[p.availability] ?? p.availability : ""}</span>
                </div>
              </Link>
            );
          })}
        </div>
        {profiles.length === 0 && (
          <p style={{ color: "var(--text-muted)" }} data-testid="developers-empty">
            Nenhum programador encontrado com esses filtros.
          </p>
        )}
      </div>
    </div>
  );
}
