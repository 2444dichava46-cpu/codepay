import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { splitPayment } from "@/lib/fees";

// POST /api/proposals/:id/accept — CLIENT who owns the project only.
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
      { error: "Você não tem permissão para aceitar esta proposta." },
      { status: 403 }
    );
  }
  if (proposal.project.status !== "OPEN") {
    return NextResponse.json(
      { error: "Este projeto já não está mais aberto para contratação." },
      { status: 409 }
    );
  }
  if (proposal.status !== "PENDING") {
    return NextResponse.json({ error: "Esta proposta já foi respondida." }, { status: 409 });
  }

  // Everything below must succeed or fail together, so the DB never ends up
  // with (say) an accepted proposal but no contract or payment record.
  const contract = await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposal.id },
      data: { status: "ACCEPTED" },
    });
    await tx.proposal.updateMany({
      where: { projectId: proposal.projectId, id: { not: proposal.id }, status: "PENDING" },
      data: { status: "REJECTED" },
    });
    // Notify the rejected developers as well.
    const otherProposals = await tx.proposal.findMany({
      where: { projectId: proposal.projectId, status: "REJECTED", id: { not: proposal.id } },
      select: { developerId: true },
    });
    await tx.project.update({
      where: { id: proposal.projectId },
      data: { status: "IN_PROGRESS" },
    });
    const createdContract = await tx.contract.create({
      data: {
        projectId: proposal.projectId,
        clientId: proposal.project.clientId,
        developerId: proposal.developerId,
        agreedAmount: proposal.amount,
        deadlineDays: proposal.deadlineDays,
      },
    });
    const { platformFee, developerAmount } = splitPayment(proposal.amount);
    await tx.payment.create({
      data: {
        contractId: createdContract.id,
        clientId: proposal.project.clientId,
        developerId: proposal.developerId,
        amount: proposal.amount,
        platformFee,
        developerAmount,
        status: "PENDING",
      },
    });
    for (const other of otherProposals) {
      await tx.notification.create({
        data: {
          userId: other.developerId,
          type: "PROPOSAL_REJECTED",
          message: `Sua proposta para "${proposal.project.title}" não foi selecionada.`,
        },
      });
    }
    await tx.notification.create({
      data: {
        userId: proposal.developerId,
        type: "PROPOSAL_ACCEPTED",
        message: `Sua proposta para "${proposal.project.title}" foi aceita!`,
      },
    });
    await tx.notification.create({
      data: {
        userId: proposal.project.clientId,
        type: "NEW_CONTRACT",
        message: `Contrato criado para "${proposal.project.title}" com ${session.name}.`,
      },
    });
    return createdContract;
  });

  return NextResponse.json({ contract });
}
