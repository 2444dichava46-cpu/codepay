import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppHeader from "../AppHeader";
import { CONTRACT_STATUS_LABELS, formatBRL, formatDate } from "@/lib/labels";

export default async function ContractsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const contracts = await prisma.contract.findMany({
    where: { OR: [{ clientId: session.sub }, { developerId: session.sub }] },
    include: {
      project: { select: { id: true, title: true, status: true } },
      client: { select: { id: true, name: true } },
      developer: { select: { id: true, name: true } },
      payment: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <AppHeader name={session.name} role={session.role} />
      <div className="wrap" style={{ padding: "28px 24px 64px", maxWidth: 860 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>Meus contratos</h1>

        {contracts.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>
            Você ainda não possui contratos.
            {session.role === "CLIENT"
              ? " Aceite uma proposta em um dos seus projetos para começar."
              : " Envie propostas para projetos abertos para começar."}
          </p>
        )}

        <div className="card" style={{ padding: 8 }}>
          {contracts.map((c) => {
            const imClient = c.clientId === session.sub;
            return (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className="contract-link"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}
                data-testid="contract-link"
              >
                <div>
                  <h5 style={{ margin: "0 0 3px", fontSize: 14 }}>{c.project.title}</h5>
                  <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
                    {imClient ? `Programador: ${c.developer.name}` : `Cliente: ${c.client.name}`} · {formatBRL(c.agreedAmount)} · {formatDate(c.createdAt)}
                  </span>
                </div>
                <span className={`badge ${c.status === "ACTIVE" ? "badge-info" : c.status === "COMPLETED" ? "badge-success" : "badge-muted"}`}>
                  {CONTRACT_STATUS_LABELS[c.status]}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
