import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { emailDeliveryApproved } from "@/lib/email";
import { formatBRL } from "@/lib/labels";

const OPEN_DELIVERY_STATUSES = ["PENDING", "SUBMITTED"] as const;

// POST /api/deliveries/:id/approve — the CLIENT approves a submitted delivery.
// When no delivery steps remain open, the contract and the project are completed
// and the developer's share is RELEASED from escrow — but only if the client's
// payment was actually confirmed (status PAID). If the gateway is still pending
// configuration the payment stays PENDING: we never fake a release.
export async function POST(
  _req: NextRequest,
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
      { error: "Apenas o cliente pode aprovar entregas." },
      { status: 403 }
    );
  }
  if (delivery.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: "Apenas entregas enviadas podem ser aprovadas." },
      { status: 409 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: "APPROVED" },
    });
    await tx.notification.create({
      data: {
        userId: contract.developerId,
        type: "DELIVERY_APPROVED",
        message: `Sua entrega para "${delivery.project.title}" foi aprovada pelo cliente.`,
      },
    });

    const openDeliveries = await tx.delivery.count({
      where: {
        projectId: delivery.projectId,
        status: { in: [...OPEN_DELIVERY_STATUSES] },
      },
    });

    let completed = false;
    let released = false;

    if (openDeliveries === 0 && contract.status === "ACTIVE") {
      completed = true;
      await tx.contract.update({
        where: { id: contract.id },
        data: { status: "COMPLETED" },
      });
      await tx.project.update({
        where: { id: delivery.projectId },
        data: { status: "COMPLETED" },
      });

      // Escrow release: only a confirmed (PAID) payment can be released.
      const payment = await tx.payment.findUnique({ where: { contractId: contract.id } });
      if (payment && payment.status === "PAID") {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "RELEASED" },
        });
        released = true;
        await tx.notification.create({
          data: {
            userId: contract.developerId,
            type: "PAYMENT_RELEASED",
            message: `Seu valor de ${formatBRL(payment.developerAmount)} foi liberado no projeto "${delivery.project.title}".`,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: contract.developerId,
          type: "PROJECT_COMPLETED",
          message: `O projeto "${delivery.project.title}" foi concluído. Parabéns!`,
        },
      });
      await tx.notification.create({
        data: {
          userId: contract.clientId,
          type: "PROJECT_COMPLETED",
          message: `O projeto "${delivery.project.title}" foi concluído. Avalie o programador!`,
        },
      });
    }

    return { completed, released };
  });

  // Fail-safe notification email to the developer (recipient from the DB).
  const [developer, payment] = await Promise.all([
    prisma.user.findUnique({
      where: { id: contract.developerId },
      select: { name: true, email: true },
    }),
    prisma.payment.findUnique({ where: { contractId: contract.id } }),
  ]);
  if (developer) {
    await emailDeliveryApproved({
      to: developer.email,
      developerName: developer.name,
      projectTitle: delivery.project.title,
      contractId: contract.id,
      developerAmountLabel: formatBRL(payment?.developerAmount ?? contract.agreedAmount * 0.9),
      released: result.released,
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
