import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { emailNewDelivery } from "@/lib/email";

// POST /api/contracts/:id/deliveries — the contracted developer submits a delivery.
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
  if (contract.developerId !== session.sub) {
    return NextResponse.json(
      { error: "Apenas o programador contratado pode enviar entregas." },
      { status: 403 }
    );
  }
  if (contract.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Este contrato não está mais ativo." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const description = (body?.description ?? "").trim();
  const link = (body?.link ?? "").trim();
  const notes = (body?.notes ?? "").trim();

  if (!description) {
    return NextResponse.json({ error: "Descreva a entrega." }, { status: 400 });
  }
  if (link && !/^https?:\/\/.+/i.test(link)) {
    return NextResponse.json(
      { error: "O link da entrega deve ser uma URL válida (http/https)." },
      { status: 400 }
    );
  }

  const delivery = await prisma.delivery.create({
    data: {
      projectId: contract.projectId,
      developerId: session.sub,
      description,
      link: link || null,
      notes: notes || null,
      status: "SUBMITTED",
    },
  });

  await createNotification(
    contract.clientId,
    "NEW_DELIVERY",
    `O programador enviou uma entrega para "${contract.project.title}".`
  );

  const [client, developer] = await Promise.all([
    prisma.user.findUnique({ where: { id: contract.clientId }, select: { name: true, email: true } }),
    prisma.user.findUnique({ where: { id: contract.developerId }, select: { name: true } }),
  ]);
  if (client && developer) {
    await emailNewDelivery({
      to: client.email,
      clientName: client.name,
      developerName: developer.name,
      projectTitle: contract.project.title,
      contractId: contract.id,
    });
  }

  return NextResponse.json({ delivery }, { status: 201 });
}
