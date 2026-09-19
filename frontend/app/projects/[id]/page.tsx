import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Avatar from "@/components/Avatar";
import AppHeader from "@/app/AppHeader";
import ProposalActions from "@/components/ProposalActions";
import ProjectOwnerActions from "@/components/ProjectOwnerActions";
import {
  PROJECT_STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
  formatBRL,
  formatDate,
} from "@/lib/labels";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true } },
      contract: { select: { id: true, status: true, developerId: true } },
      _count: { select: { proposals: true } },
    },
  });
  if (!project) notFound();

  const isOwner = session?.sub === project.clientId;
  const isContractedDeveloper = project.contract?.developerId === session?.sub;

  const proposals = isOwner
    ? await prisma.proposal.findMany({
        where: { projectId: project.id },
        include: {
          developer: {
            select: {
              id: true,
              name: true,
              developerProfile: {
                select: {
                  headline: true,
                  ratingAvg: true,
                  ratingCount: true,
                  hourlyRate: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const myProposal =
    session?.role === "DEVELOPER"
      ? await prisma.proposal.findUnique({
          where: { projectId_developerId: { projectId: project.id, developerId: session.sub } },
        })
      : null;

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
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }} data-testid="project-title">{project.title}</h1>
              <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>
                Publicado por {project.client.name} · {project._count.proposals} propostas
              </span>
            </div>
            <span className={`badge ${project.status === "OPEN" ? "badge-info" : project.status === "IN_PROGRESS" ? "badge-success" : "badge-muted"}`} data-testid="project-status-badge">
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, margin: "20px 0" }}>
            <div><div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Categoria</div><div style={{ fontWeight: 700, fontSize: 14 }}>{project.category}</div></div>
            <div><div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Orçamento</div><div style={{ fontWeight: 700, fontSize: 14 }}>{formatBRL(project.budgetMin)} – {formatBRL(project.budgetMax)}</div></div>
            <div><div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Prazo</div><div style={{ fontWeight: 700, fontSize: 14 }}>{project.deadlineDays} dias</div></div>
            <div><div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Tecnologias</div><div style={{ fontWeight: 700, fontSize: 14 }}>{project.technologies || "—"}</div></div>
          </div>

          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7 }}>{project.description}</p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {session?.role === "DEVELOPER" && project.status === "OPEN" && (
              myProposal ? (
                <span className="badge badge-success" data-testid="my-proposal-badge">Você já enviou uma proposta</span>
              ) : (
                <Link href={`/projects/${project.id}/propose`} className="btn btn-primary" data-testid="send-proposal-link">Enviar proposta</Link>
              )
            )}
            {!session && (
              <Link href="/login" className="btn btn-primary">Entrar para enviar proposta</Link>
            )}

            {(isOwner || isContractedDeveloper) && project.contract && (
              <Link href={`/contracts/${project.contract.id}`} className="btn btn-outline" data-testid="view-contract-link">
                Ver contrato
              </Link>
            )}
          </div>

          {isOwner && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <ProjectOwnerActions
                projectId={project.id}
                canEdit={project.status === "OPEN"}
                canCancel={project.status === "OPEN" || project.status === "IN_PROGRESS"}
              />
            </div>
          )}
        </div>

        {isOwner && (
          <div className="card" style={{ padding: 8 }}>
            <div style={{ padding: "10px 12px", fontWeight: 700, fontSize: 15 }}>
              Propostas recebidas ({proposals.length})
            </div>
            {proposals.length === 0 && (
              <p style={{ padding: "0 12px 16px", color: "var(--text-muted)", fontSize: 13.5 }}>
                Nenhuma proposta ainda.
              </p>
            )}
            {proposals.map((pr) => {
              const profile = pr.developer.developerProfile;
              return (
                <div key={pr.id} style={{ padding: 16, borderTop: "1px solid var(--border)" }} data-testid="proposal-item">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <Avatar src={profile?.photoUrl} name={pr.developer.name} size={40} />
                      <div>
                        <Link href={`/developers/${pr.developer.id}`} style={{ fontWeight: 700, fontSize: 14, color: "var(--primary)" }} data-testid="proposal-profile-link">
                          {pr.developer.name}
                        </Link>
                        <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
                          {profile?.headline || "Programador"}
                          {profile && profile.ratingCount > 0 && (
                            <> · <span className="stars">{"★".repeat(Math.round(profile.ratingAvg))}</span> {profile.ratingAvg.toFixed(1)} ({profile.ratingCount})</>
                          )}
                          {profile?.hourlyRate != null && <> · {formatBRL(profile.hourlyRate)}/h</>}
                        </div>
                      </div>
                    </div>
                    <span className={`badge ${pr.status === "ACCEPTED" ? "badge-success" : pr.status === "REJECTED" ? "badge-danger" : "badge-muted"}`}>
                      {PROPOSAL_STATUS_LABELS[pr.status]}
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 8px" }}>{pr.message}</p>
                  <div style={{ fontSize: 12.5, color: "var(--text-soft)", marginBottom: 10 }}>
                    Valor: {formatBRL(pr.amount)} · Prazo: {pr.deadlineDays} dias
                    {pr.experience && <> · Experiência: {pr.experience}</>}
                  </div>
                  {project.status === "OPEN" && pr.status === "PENDING" && (
                    <ProposalActions proposalId={pr.id} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

