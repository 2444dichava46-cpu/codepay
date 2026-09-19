// Client-safe labels and formatters shared by pages and components.

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Em aberto",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceita",
  REJECTED: "Rejeitada",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  SUBMITTED: "Entregue — aguardando aprovação",
  APPROVED: "Aprovada",
  REVISION_REQUESTED: "Alteração solicitada",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pagamento pendente",
  PAID: "Pago",
  RELEASED: "Liberado ao programador",
  FAILED: "Falhou",
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  NEW_PROPOSAL: "Nova proposta",
  PROPOSAL_ACCEPTED: "Proposta aceita",
  PROPOSAL_REJECTED: "Proposta rejeitada",
  NEW_CONTRACT: "Novo contrato",
  NEW_MESSAGE: "Nova mensagem",
  NEW_DELIVERY: "Nova entrega",
  DELIVERY_APPROVED: "Entrega aprovada",
  REVISION_REQUESTED: "Solicitação de alteração",
  PROJECT_COMPLETED: "Projeto concluído",
  PROJECT_CANCELLED: "Projeto cancelado",
  NEW_REVIEW: "Nova avaliação",
};

export const CATEGORIES = [
  "Desenvolvimento Web",
  "Front-end",
  "Back-end",
  "Full Stack",
  "Mobile",
  "Python",
  "Dados & IA",
  "DevOps",
];

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Disponível para trabalho",
  busy: "Ocupado no momento",
};

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
