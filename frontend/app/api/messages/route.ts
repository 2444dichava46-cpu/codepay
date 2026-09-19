import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

// GET /api/messages — all my messages (direct + contract threads), oldest first.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: session.sub }, { receiverId: session.sub }] },
    include: {
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  return NextResponse.json({ messages });
}

// POST /api/messages — send a direct message to another user.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const receiverId = (body?.receiverId ?? "").trim();
  const content = (body?.content ?? "").trim();
  const projectId = body?.projectId ? String(body.projectId) : null;

  if (!receiverId) {
    return NextResponse.json({ error: "Destinatário inválido." }, { status: 400 });
  }
  if (receiverId === session.sub) {
    return NextResponse.json({ error: "Você não pode enviar uma mensagem para si mesmo." }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "Escreva uma mensagem." }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: "Mensagem muito longa (máx. 5000 caracteres)." }, { status: 400 });
  }

  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) {
    return NextResponse.json({ error: "Destinatário não encontrado." }, { status: 404 });
  }
  if (projectId) {
    const contract = await prisma.contract.findUnique({ where: { projectId } });
    if (!contract || (contract.clientId !== session.sub && contract.developerId !== session.sub)) {
      return NextResponse.json(
        { error: "Você não tem permissão para enviar mensagens neste projeto." },
        { status: 403 }
      );
    }
  }

  const message = await prisma.message.create({
    data: { senderId: session.sub, receiverId, projectId, content },
    include: {
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
  });

  await createNotification(receiverId, "NEW_MESSAGE", `Nova mensagem de ${session.name}.`);

  return NextResponse.json({ message }, { status: 201 });
}
