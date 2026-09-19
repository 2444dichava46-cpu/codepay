import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

// POST /api/contracts/:id/review — the CLIENT reviews the developer after the
// contract is completed. One review per contract (unique per project+author).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { project: { select: { id: true, title: true } } },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  }
  if (contract.clientId !== session.sub) {
    return NextResponse.json(
      { error: "Apenas o cliente pode avaliar o programador deste contrato." },
      { status: 403 }
    );
  }
  if (contract.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "A avaliação fica disponível após a conclusão do projeto." },
      { status: 409 }
    );
  }

  const existing = await prisma.review.findUnique({
    where: { projectId_authorId: { projectId: contract.projectId, authorId: session.sub } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Você já avaliou este contrato." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const rating = Number(body?.rating);
  const comment = (body?.comment ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "A nota deve ser de 1 a 5." }, { status: 400 });
  }

  const review = await prisma.review.create({
    data: {
      projectId: contract.projectId,
      authorId: session.sub,
      targetId: contract.developerId,
      rating,
      comment: comment || null,
    },
  });

  // Recompute the developer's public rating aggregate from all reviews received.
  const agg = await prisma.review.aggregate({
    where: { targetId: contract.developerId },
    _avg: { rating: true },
    _count: { id: true },
  });
  await prisma.developerProfile.upsert({
    where: { userId: contract.developerId },
    update: {
      ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100,
      ratingCount: agg._count.id,
    },
    create: {
      userId: contract.developerId,
      technologies: "",
      specialties: "",
      ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100,
      ratingCount: agg._count.id,
    },
  });

  await createNotification(
    contract.developerId,
    "NEW_REVIEW",
    `Você recebeu uma avaliação (${rating}/5) no projeto "${contract.project.title}".`
  );

  return NextResponse.json({ review }, { status: 201 });
}
