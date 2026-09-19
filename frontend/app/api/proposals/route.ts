import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { emailNewProposal } from "@/lib/email";
import { formatBRL } from "@/lib/labels";

// POST /api/proposals — DEVELOPER only.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }
  if (session.role !== "DEVELOPER") {
    return NextResponse.json(
      { error: "Apenas programadores podem enviar propostas." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const projectId = body?.projectId;
  const amount = Number(body?.amount);
  const deadlineDays = Number(body?.deadlineDays);
  const message = (body?.message ?? "").trim();
  const experience = (body?.experience ?? "").trim();

  if (!projectId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Valor da proposta inválido." }, { status: 400 });
  }
  if (!Number.isFinite(deadlineDays) || deadlineDays <= 0) {
    return NextResponse.json({ error: "Prazo de entrega inválido." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Escreva uma mensagem para o cliente." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
  if (project.status !== "OPEN") {
    return NextResponse.json(
      { error: "Este projeto não está mais recebendo propostas." },
      { status: 409 }
    );
  }

  const existing = await prisma.proposal.findUnique({
    where: { projectId_developerId: { projectId, developerId: session.sub } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Você já enviou uma proposta para este projeto." },
      { status: 409 }
    );
  }

  const proposal = await prisma.proposal.create({
    data: {
      projectId,
      developerId: session.sub,
      amount,
      deadlineDays,
      message,
      experience: experience || null,
    },
  });

  await prisma.notification.create({
    data: {
      userId: project.clientId,
      type: "NEW_PROPOSAL",
      message: `Você recebeu uma nova proposta para "${project.title}".`,
    },
  });

  const client = await prisma.user.findUnique({
    where: { id: project.clientId },
    select: { name: true, email: true },
  });
  if (client) {
    await emailNewProposal({
      to: client.email,
      clientName: client.name,
      developerName: session.name,
      projectTitle: project.title,
      projectId: project.id,
      amountLabel: formatBRL(amount),
    });
  }

  return NextResponse.json({ proposal }, { status: 201 });
}
