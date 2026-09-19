import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

async function getContractForParticipant(contractId: string, userId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { project: { select: { id: true, title: true } } },
  });
  if (!contract) return { error: "not_found" as const };
  if (contract.clientId !== userId && contract.developerId !== userId) {
    return { error: "forbidden" as const };
  }
  return { contract };
}

// GET /api/contracts/:id/messages — chat history; participants only.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const result = await getContractForParticipant(params.id, session.sub);
  if ("error" in result) {
    return NextResponse.json(
      {
        error:
          result.error === "not_found"
            ? "Contrato não encontrado."
            : "Apenas os participantes do contrato podem acessar a conversa.",
      },
      { status: result.error === "not_found" ? 404 : 403 }
    );
  }
  const { contract } = result;

  const messages = await prisma.message.findMany({
    where: { projectId: contract.projectId },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  // Mark the messages I received in this thread as read.
  await prisma.message.updateMany({
    where: { projectId: contract.projectId, receiverId: session.sub, read: false },
    data: { read: true },
  });

  return NextResponse.json({ messages });
}

// POST /api/contracts/:id/messages — send a chat message to the other party.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const result = await getContractForParticipant(params.id, session.sub);
  if ("error" in result) {
    return NextResponse.json(
      {
        error:
          result.error === "not_found"
            ? "Contrato não encontrado."
            : "Apenas os participantes do contrato podem enviar mensagens.",
      },
      { status: result.error === "not_found" ? 404 : 403 }
    );
  }
  const { contract } = result;

  const body = await req.json().catch(() => null);
  const content = (body?.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "Escreva uma mensagem." }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: "Mensagem muito longa (máx. 5000 caracteres)." }, { status: 400 });
  }

  const receiverId =
    contract.clientId === session.sub ? contract.developerId : contract.clientId;

  const message = await prisma.message.create({
    data: {
      senderId: session.sub,
      receiverId,
      projectId: contract.projectId,
      content,
    },
    include: { sender: { select: { id: true, name: true } } },
  });

  await createNotification(
    receiverId,
    "NEW_MESSAGE",
    `Nova mensagem de ${session.name} no contrato de "${contract.project.title}".`
  );

  return NextResponse.json({ message }, { status: 201 });
}
