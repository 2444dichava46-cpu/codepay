import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { emailRevisionRequested } from "@/lib/email";

// POST /api/deliveries/:id/revision — the CLIENT requests changes on a
// submitted delivery. The request is registered as a message in the contract
// chat and as a notification, and the developer may submit a new delivery.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: { project: { include: { contract: true } } },
  });
  if (!delivery) {
    return NextResponse.json({ error: "Entrega não encontrada." }, { status: 404 });
  }
  const contract = delivery.project.contract;
  if (!contract) {
    return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  }
  if (contract.clientId !== session.sub) {
    return NextResponse.json(
      { error: "Apenas o cliente pode solicitar alterações." },
      { status: 403 }
    );
  }
  if (delivery.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: "Apenas entregas enviadas podem receber solicitação de alteração." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const feedback = (body?.feedback ?? "").trim();
  if (!feedback) {
    return NextResponse.json(
      { error: "Descreva o que precisa ser alterado." },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: "REVISION_REQUESTED" },
    });
    await tx.message.create({
      data: {
        senderId: session.sub,
        receiverId: contract.developerId,
        projectId: delivery.projectId,
        content: `Solicitação de alteração: ${feedback}`,
      },
    });
  });

  await createNotification(
    contract.developerId,
    "REVISION_REQUESTED",
    `O cliente solicitou alterações na entrega de "${delivery.project.title}": ${feedback}`
  );

  const developer = await prisma.user.findUnique({
    where: { id: contract.developerId },
    select: { name: true, email: true },
  });
  if (developer) {
    await emailRevisionRequested({
      to: developer.email,
      developerName: developer.name,
      projectTitle: delivery.project.title,
      contractId: contract.id,
    });
  }

  return NextResponse.json({ ok: true });
}
