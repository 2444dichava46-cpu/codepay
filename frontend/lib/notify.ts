import { prisma } from "@/lib/db";

/** Create a notification. Never breaks the main flow — failures are logged only. */
export async function createNotification(
  userId: string,
  type: string,
  message: string
): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, type, message } });
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}
