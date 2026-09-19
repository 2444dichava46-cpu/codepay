// Removes accounts created by automated smoke tests so the public developer
// showcase only contains real users (and the clearly-marked "(Demo)" seed).
// Safe to re-run. Keeps the two documented verification accounts.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const KEEP = ["cli.9051@teste.com", "dev.9051@teste.com", "cliente@exemplo.com", "dev@exemplo.com"];
const TEST_PATTERNS = ["smoke", "@t.com", "@test.com", "ui.cliente", "ui.dev", "escrowdev", "delivered@resend.dev"];

const users = await prisma.user.findMany({ select: { id: true, email: true } });
const doomed = users.filter(
  (u) => !KEEP.includes(u.email) && TEST_PATTERNS.some((p) => u.email.includes(p))
);

for (const user of doomed) {
  const projects = await prisma.project.findMany({
    where: { OR: [{ clientId: user.id }, { contract: { developerId: user.id } }] },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  await prisma.$transaction([
    prisma.review.deleteMany({ where: { OR: [{ authorId: user.id }, { targetId: user.id }, { projectId: { in: projectIds } }] } }),
    prisma.message.deleteMany({ where: { OR: [{ senderId: user.id }, { receiverId: user.id }, { projectId: { in: projectIds } }] } }),
    prisma.delivery.deleteMany({ where: { OR: [{ developerId: user.id }, { projectId: { in: projectIds } }] } }),
    prisma.payment.deleteMany({ where: { OR: [{ clientId: user.id }, { developerId: user.id }] } }),
    prisma.contract.deleteMany({ where: { OR: [{ clientId: user.id }, { developerId: user.id }, { projectId: { in: projectIds } }] } }),
    prisma.proposal.deleteMany({ where: { OR: [{ developerId: user.id }, { projectId: { in: projectIds } }] } }),
    prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.developerProfile.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  console.log("removed test account:", user.email);
}

console.log(`done — ${doomed.length} test account(s) removed`);
await prisma.$disconnect();
