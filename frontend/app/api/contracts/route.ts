import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/contracts — contracts where I am the client or the developer.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const contracts = await prisma.contract.findMany({
    where: { OR: [{ clientId: session.sub }, { developerId: session.sub }] },
    include: {
      project: { select: { id: true, title: true, status: true } },
      client: { select: { id: true, name: true } },
      developer: { select: { id: true, name: true } },
      payment: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ contracts });
}
