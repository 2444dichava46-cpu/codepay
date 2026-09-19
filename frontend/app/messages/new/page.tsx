import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppHeader from "../../AppHeader";
import NewMessageForm from "@/components/NewMessageForm";

export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: { to?: string; intent?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const to = (searchParams.to ?? "").trim();
  if (!to) redirect("/messages");
  if (to === session.sub) redirect("/messages");

  const receiver = await prisma.user.findUnique({
    where: { id: to },
    select: { id: true, name: true },
  });
  if (!receiver) notFound();

  const prefill =
    searchParams.intent === "hire"
      ? `Olá, ${receiver.name}! Vi seu perfil no Code Pay e gostaria de conversar sobre uma oportunidade de contratação.`
      : "";

  return (
    <div>
      <AppHeader name={session.name} role={session.role} />
      <div className="wrap" style={{ maxWidth: 560, padding: "40px 24px 64px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          Nova mensagem para {receiver.name}
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 20, fontSize: 13.5 }}>
          A conversa também aparece na página Mensagens.
        </p>
        <NewMessageForm receiverId={receiver.id} receiverName={receiver.name} prefill={prefill} />
      </div>
    </div>
  );
}
