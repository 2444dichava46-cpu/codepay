import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET  /api/notifications — my notifications (latest first) + unread count.
// POST /api/notifications — mark all my notifications as read.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: session.sub, read: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa entrar na sua conta." }, { status: 401 });
  }

  await prisma.notification.updateMany({
    where: { userId: session.sub, read: false },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
