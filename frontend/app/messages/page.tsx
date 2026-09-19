import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import MessagesPageClient from "./MessagesPageClient";

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <MessagesPageClient meId={session.sub} meName={session.name} meRole={session.role} />;
}
