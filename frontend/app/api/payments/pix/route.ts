import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isPaymentGatewayConfigured } from "@/lib/payments";

// POST /api/payments/pix — the client requests a Pix charge for a contract.
//
// While MERCADOPAGO_ACCESS_TOKEN is not configured, this responds 503 with
// status CONFIGURATION_PENDING. No fake payment is ever created: the internal
// Payment record stays PENDING until a real Mercado Pago payment is confirmed
// by the signed webhook.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const contractId = (body?.contractId ?? "").trim();
  if (!contractId) {
    return NextResponse.json({ error: "Contrato inválido." }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { contractId } });
  if (!payment) {
    return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
  }
  if (payment.clientId !== session.sub) {
    return NextResponse.json(
      { error: "Apenas o cliente do contrato pode gerar o pagamento." },
      { status: 403 }
    );
  }

  if (!isPaymentGatewayConfigured()) {
    return NextResponse.json(
      {
        status: "CONFIGURATION_PENDING",
        message:
          "Pagamento pendente de configuração: a integração Mercado Pago / Pix será ativada quando MERCADOPAGO_ACCESS_TOKEN for configurado no ambiente.",
      },
      { status: 503 }
    );
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { client: { select: { email: true } } },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  }

  try {
    const mp = new Payment(
      new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })
    );
    const result = await mp.create({
      body: {
        transaction_amount: payment.amount,
        description: `Code Pay — contrato ${contractId}`,
        payment_method_id: "pix",
        payer: { email: contract.client.email },
        external_reference: `codepay:${contractId}`,
      },
      requestOptions: { idempotencyKey: `codepay:${contractId}` },
    });
    const td = result.point_of_interaction?.transaction_data;
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalPaymentId: String(result.id),
        status: result.status === "approved" ? "PAID" : "PENDING",
      },
    });
    return NextResponse.json({
      paymentId: result.id,
      status: result.status,
      qrCode: td?.qr_code,
      qrCodeBase64: td?.qr_code_base64,
      ticketUrl: td?.ticket_url,
    });
  } catch (error) {
    console.error("Mercado Pago create payment failed", error);
    return NextResponse.json({ error: "payment_creation_failed" }, { status: 502 });
  }
}
