import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/projects/:id/cancel — owner only.
// OPEN: straight cancel. IN_PROGRESS: also cancels the active contract and
// notifies the developer. COMPLETED/CANCELLED projects can't be cancelled.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { contract: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
  if (project.clientId !== session.sub) {
    return NextResponse.json(
      { error: "Apenas o cliente que publicou o projeto pode cancelá-lo." },
      { status: 403 }
    );
  }
  if (project.status === "COMPLETED" || project.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Este projeto já foi finalizado e não pode ser cancelado." },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    if (project.contract && project.contract.status === "ACTIVE") {
      await tx.contract.update({
        where: { id: project.contract.id },
        data: { status: "CANCELLED" },
      });
    }
    await tx.project.update({
      where: { id: project.id },
      data: { status: "CANCELLED" },
    });
    if (project.contract) {
      await tx.notification.create({
        data: {
          userId: project.contract.developerId,
          type: "PROJECT_CANCELLED",
          message: `O projeto "${project.title}" foi cancelado pelo cliente.`,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
