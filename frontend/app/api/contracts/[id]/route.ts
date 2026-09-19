import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/contracts/:id — only the client and the developer involved in the
// contract may read it. Anyone else gets 403/404 (no data leakage).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, title: true, description: true, status: true } },
      client: { select: { id: true, name: true } },
      developer: { select: { id: true, name: true } },
      payment: true,
    },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  }
  if (contract.clientId !== session.sub && contract.developerId !== session.sub) {
    return NextResponse.json(
      { error: "Apenas os participantes do contrato podem visualizá-lo." },
      { status: 403 }
    );
  }

  const [review, deliveries] = await Promise.all([
    prisma.review.findFirst({
      where: { projectId: contract.projectId },
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.delivery.findMany({
      where: { projectId: contract.projectId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ contract: { ...contract, deliveries }, review });
}
