import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { proposals: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  const isOwner = session?.sub === project.clientId;

  // Only the owning client can see the list of proposals; everyone else
  // (including the developer who submitted one) just sees the count.
  const proposals = isOwner
    ? await prisma.proposal.findMany({
        where: { projectId: project.id },
        include: {
          developer: {
            select: {
              id: true,
              name: true,
              developerProfile: {
                select: { headline: true, ratingAvg: true, ratingCount: true, hourlyRate: true, photoUrl: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  let myProposal = null;
  if (session?.role === "DEVELOPER") {
    myProposal = await prisma.proposal.findUnique({
      where: { projectId_developerId: { projectId: project.id, developerId: session.sub } },
    });
  }

  return NextResponse.json({ project, isOwner, proposals, myProposal });
}

// PATCH /api/projects/:id — owner only, while the project is still OPEN.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
  if (project.clientId !== session.sub) {
    return NextResponse.json(
      { error: "Apenas o cliente que publicou o projeto pode editá-lo." },
      { status: 403 }
    );
  }
  if (project.status !== "OPEN") {
    return NextResponse.json(
      { error: "O projeto só pode ser editado enquanto estiver em aberto." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const title = body?.title != null ? String(body.title).trim() : project.title;
  const description =
    body?.description != null ? String(body.description).trim() : project.description;
  const category =
    body?.category != null ? String(body.category).trim() : project.category;
  const technologies =
    body?.technologies != null ? String(body.technologies).trim() : project.technologies;
  const budgetMin = body?.budgetMin != null ? Number(body.budgetMin) : project.budgetMin;
  const budgetMax = body?.budgetMax != null ? Number(body.budgetMax) : project.budgetMax;
  const deadlineDays =
    body?.deadlineDays != null ? Number(body.deadlineDays) : project.deadlineDays;

  const errors: string[] = [];
  if (!title) errors.push("Título é obrigatório.");
  if (!description) errors.push("Descrição é obrigatória.");
  if (!category) errors.push("Categoria é obrigatória.");
  if (!Number.isFinite(budgetMin) || budgetMin < 0) errors.push("Orçamento mínimo inválido.");
  if (!Number.isFinite(budgetMax) || budgetMax < budgetMin) errors.push("Orçamento máximo inválido.");
  if (!Number.isFinite(deadlineDays) || deadlineDays <= 0) errors.push("Prazo inválido.");
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { title, description, category, technologies, budgetMin, budgetMax, deadlineDays },
  });

  return NextResponse.json({ project: updated });
}
