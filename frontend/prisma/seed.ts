// ⚠️ DEMO DATA — isolated on purpose (briefing PHASE 19/21: no functional page
// may depend on this running, and fictional users must be clearly marked).
// Run manually with:  npm run db:seed
//
// Creates two clearly-marked demo accounts and one demo project so local/dev
// environments can be exercised quickly. Real usage never needs this script.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const client = await prisma.user.upsert({
    where: { email: "cliente@exemplo.com" },
    update: {},
    create: {
      name: "(Demo) Empresa Tech",
      email: "cliente@exemplo.com",
      passwordHash,
      role: "CLIENT",
    },
  });

  const developer = await prisma.user.upsert({
    where: { email: "dev@exemplo.com" },
    update: {},
    create: {
      name: "(Demo) Lucas Silva",
      email: "dev@exemplo.com",
      passwordHash,
      role: "DEVELOPER",
      developerProfile: {
        create: {
          headline: "Full Stack Developer",
          bio: "DEMO: Desenvolvedor full stack com experiência em React, Node.js e PostgreSQL.",
          location: "São Paulo, SP",
          availability: "available",
          hourlyRate: 120,
          technologies: "React,Node.js,PostgreSQL,TypeScript",
          specialties: "Desenvolvimento Web,APIs e Integrações",
        },
      },
    },
  });

  await prisma.project.create({
    data: {
      clientId: client.id,
      title: "(Demo) Plataforma de delivery",
      description:
        "DEMO: Precisamos desenvolver uma plataforma de delivery completa, com sistema de pedidos, pagamentos e painel administrativo.",
      category: "Desenvolvimento Web",
      technologies: "React,Node.js,PostgreSQL",
      budgetMin: 3000,
      budgetMax: 5000,
      deadlineDays: 30,
    },
  });

  console.log("⚠️  Seed de DEMO concluído — dados fictícios, não use em produção.");
  console.log("  Cliente (demo):     cliente@exemplo.com / password123");
  console.log("  Programador (demo): dev@exemplo.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
