import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppHeader from "../../AppHeader";
import Chat from "@/components/Chat";
import DeliveryPanel from "@/components/DeliveryPanel";
import ReviewPanel from "@/components/ReviewPanel";
import PixPaymentPanel from "@/components/PixPaymentPanel";
import { isPaymentGatewayConfigured } from "@/lib/payments";
import {
  CONTRACT_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  formatBRL,
  formatDate,
} from "@/lib/labels";

export default async function ContractPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, title: true, description: true, status: true } },
      client: { select: { id: true, name: true } },
      developer: { select: { id: true, name: true } },
      payment: true,
    },
  });
  // Not found OR not a participant: same response, no data leakage.
  if (!contract || (contract.clientId !== session.sub && contract.developerId !== session.sub)) {
    notFound();
  }

  const [review, deliveriesRaw] = await Promise.all([
    prisma.review.findFirst({
      where: { projectId: contract.projectId },
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.delivery.findMany({
      where: { projectId: contract.projectId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const imClient = contract.clientId === session.sub;
  const deliveries = deliveriesRaw.map((d) => ({
    id: d.id,
    description: d.description,
    link: d.link,
    notes: d.notes,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
  }));
  const reviewData = review
    ? {
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        author: review.author,
      }
    : null;

  return (
    <div>
      <AppHeader name={session.name} role={session.role} />
      <div className="wrap" style={{ padding: "28px 24px 64px", maxWidth: 900 }}>
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <span style={{ fontSize: 12, color: "var(--text-soft)", fontWeight: 600 }}>CONTRATO</span>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: "4px 0" }} data-testid="contract-project-title">{contract.project.title}</h1>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Contratado em {formatDate(contract.createdAt)}
              </span>
            </div>
            <span className={`badge ${contract.status === "ACTIVE" ? "badge-info" : contract.status === "COMPLETED" ? "badge-success" : "badge-muted"}`} data-testid="contract-status-badge">
              {CONTRACT_STATUS_LABELS[contract.status]}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, margin: "20px 0" }}>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Projeto</div>
              <Link href={`/projects/${contract.projectId}`} style={{ fontWeight: 700, fontSize: 14, color: "var(--primary)" }} data-testid="contract-project-link">
                Ver projeto
              </Link>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Cliente</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{contract.client.name}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Programador</div>
              <Link href={`/developers/${contract.developerId}`} style={{ fontWeight: 700, fontSize: 14, color: "var(--primary)" }} data-testid="contract-developer-link">
                {contract.developer.name}
              </Link>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Valor acordado</div>
              <div style={{ fontWeight: 700, fontSize: 14 }} data-testid="contract-amount">{formatBRL(contract.agreedAmount)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>Prazo</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{contract.deadlineDays ? `${contract.deadlineDays} dias` : "—"}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 12px" }}>Pagamento</h3>
          <PixPaymentPanel
            contractId={contract.id}
            payment={
              contract.payment
                ? {
                    amount: contract.payment.amount,
                    platformFee: contract.payment.platformFee,
                    developerAmount: contract.payment.developerAmount,
                    status: contract.payment.status,
                  }
                : null
            }
            gatewayConfigured={isPaymentGatewayConfigured()}
            pixKey={process.env.PLATFORM_PIX_KEY ?? ""}
            meIsClient={imClient}
          />
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 12px" }}>Entregas e aprovação</h3>
          <DeliveryPanel
            contractId={contract.id}
            deliveries={deliveries}
            meIsDeveloper={contract.developerId === session.sub}
            meIsClient={imClient}
            contractActive={contract.status === "ACTIVE"}
          />
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 12px" }}>Chat do contrato</h3>
          <Chat contractId={contract.id} meId={session.sub} />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 12px" }}>Avaliação</h3>
          <ReviewPanel
            contractId={contract.id}
            meIsClient={imClient}
            contractCompleted={contract.status === "COMPLETED"}
            review={reviewData}
          />
        </div>
      </div>
    </div>
  );
}
