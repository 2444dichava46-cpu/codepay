import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

// POST /api/proposals/:id/reject — CLIENT who owns the project only.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: params.id },
    include: { project: true },
  });
  if (!proposal) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }
  if (proposal.project.clientId !== session.sub) {
    return NextResponse.json(
      { error: "Você não tem permissão para rejeitar esta proposta." },
      { status: 403 }
    );
  }
  if (proposal.status !== "PENDING") {
    return NextResponse.json({ error: "Esta proposta já foi respondida." }, { status: 409 });
  }
  if (proposal.project.status !== "OPEN") {
    return NextResponse.json(
      { error: "Propostas só podem ser rejeitadas enquanto o projeto estiver em aberto." },
      { status: 409 }
    );
  }

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { status: "REJECTED" },
  });
  await createNotification(
    proposal.developerId,
    "PROPOSAL_REJECTED",
    `Sua proposta para "${proposal.project.title}" foi rejeitada pelo cliente.`
  );

  return NextResponse.json({ ok: true });
}
