// TEST FIXTURE ONLY — marks a contract's payment as PAID directly in the DB so
// the escrow-release logic can be exercised without a live gateway.
// This is NOT an application code path: the app itself only ever sets PAID from
// the signed Mercado Pago webhook.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const contractId = process.argv[2];
if (!contractId) {
  console.error("usage: node setpaid.mjs <contractId>");
  process.exit(1);
}
const updated = await prisma.payment.update({
  where: { contractId },
  data: { status: "PAID" },
});
console.log("fixture: payment", updated.id, "->", updated.status);
await prisma.$disconnect();
