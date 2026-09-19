import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/projects?category=Web&tech=React&q=delivery
// Public: returns only OPEN projects for discovery.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const tech = searchParams.get("tech");
  const q = searchParams.get("q");

  const projects = await prisma.project.findMany({
    where: {
      status: "OPEN",
      ...(category ? { category } : {}),
      ...(tech ? { technologies: { contains: tech } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { proposals: true } } },
  });

  return NextResponse.json({ projects });
}

// POST /api/projects — CLIENT only.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }
  if (session.role !== "CLIENT") {
    return NextResponse.json(
      { error: "Apenas contas de cliente podem publicar projetos." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const title = (body?.title ?? "").trim();
  const description = (body?.description ?? "").trim();
  const category = (body?.category ?? "").trim();
  const technologies = (body?.technologies ?? "").trim();
  const budgetMin = Number(body?.budgetMin);
  const budgetMax = Number(body?.budgetMax);
  const deadlineDays = Number(body?.deadlineDays);

  const errors: string[] = [];
  if (!title) errors.push("Título é obrigatório.");
  if (!description) errors.push("Descrição é obrigatória.");
  if (!category) errors.push("Categoria é obrigatória.");
  if (!Number.isFinite(budgetMin) || budgetMin < 0) errors.push("Orçamento mínimo inválido.");
  if (!Number.isFinite(budgetMax) || budgetMax < budgetMin) errors.push("Orçamento máximo inválido.");
  if (!Number.isFinite(deadlineDays) || deadlineDays <= 0) errors.push("Prazo inválido.");

  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      clientId: session.sub,
      title,
      description,
      category,
      technologies,
      budgetMin,
      budgetMax,
      deadlineDays,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
