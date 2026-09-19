import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { splitPayment } from "@/lib/fees";

/**
 * Payment architecture — MVP scaffolding.
 *
 * The platform Pix gateway is Mercado Pago. While MERCADOPAGO_ACCESS_TOKEN is
 * not configured in .env, every charge stays in "configuration pending" state:
 * the UI says so explicitly and NO code path marks a payment as PAID without a
 * confirmed Mercado Pago payment (created via /api/payments/pix and confirmed
 * by the signed webhook in /api/webhooks/mercadopago).
 */
export function isPaymentGatewayConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

export function paymentGatewayPendingMessage(): string {
  return "Pagamento pendente de configuração: a integração com o gateway (Mercado Pago / Pix) será ativada quando MERCADOPAGO_ACCESS_TOKEN for configurado no ambiente.";
}

/** Creates the internal PENDING record with the Code Pay fee split already calculated. */
export async function createPendingPayment(
  tx: Prisma.TransactionClient,
  contractId: string,
  clientId: string,
  developerId: string,
  amount: number
) {
  const { platformFee, developerAmount } = splitPayment(amount);
  return tx.payment.create({
    data: {
      contractId,
      clientId,
      developerId,
      amount,
      platformFee,
      developerAmount,
      status: "PENDING",
    },
  });
}

export { splitPayment };
