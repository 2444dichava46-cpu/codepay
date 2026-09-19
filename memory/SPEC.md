# Code Pay — SPEC

Marketplace BR que conecta clientes a programadores. Next.js 14 App Router +
Prisma 5 + SQLite (`prisma/dev.db`). Tudo em `/app/frontend` (o supervisor
programa `frontend` roda `yarn dev` = `next dev -H 0.0.0.0` na porta 3000; as
APIs são Route Handlers do próprio Next em `/api/*`).

**Gateway de API**: o ingress da plataforma manda páginas para a porta 3000 e
`/api/*` para a 8001 (FastAPI). Por isso `backend/server.py` é um proxy fino:
repassa todo `/api/*` para o Next (preservando cookies e status). Não registre
lógica de negócio lá — as rotas reais vivem em `frontend/app/api/**`.

**Armadilhas conhecidas**: (1) nunca criar notificação com o client global
dentro de `prisma.$transaction` — use `tx`, senão SQLite deadlocka (P2028);
(2) `npm run build` no mesmo diretório do `next dev` corrompe `.next` — pare o
dev server antes.

## Autenticação
- Sessão: JWT assinado (`jose`) em cookie httpOnly `cp_session` (7 dias).
  Senhas com bcrypt. `lib/auth.ts` (`getSession`) + `middleware.ts`
  (gating de papel; cada API re-valida).
- Papéis: `CLIENT` (publica projetos, aceita propostas, aprova entregas,
  avalia) e `DEVELOPER` (edita perfil público, envia propostas, entrega).

## Fluxo principal (ponta a ponta)
cadastro → login → cliente publica projeto (`/projects/new`) → programador
encontra (`/projects` com filtros) → envia proposta (`/projects/[id]/propose`)
→ cliente aceita (POST `/api/proposals/[id]/accept`, transacional: proposta
ACCEPTED, demais REJECTED, projeto IN_PROGRESS, Contract + Payment PENDING
criados) → `/contracts/[id]` → chat (polling 5s) → programador envia entrega →
cliente aprova (contrato+projeto viram COMPLETED quando não há etapas abertas)
ou solicita alteração → cliente avalia (1–5 + comentário; média/contagem
recalculadas no DeveloperProfile; único por contrato).

## Modelos (Prisma)
User (role CLIENT|DEVELOPER), DeveloperProfile (photoUrl, headline, bio,
location, availability, hourlyRate, technologies, specialties, portfolio,
ratingAvg, ratingCount), Project (status OPEN|IN_PROGRESS|COMPLETED|CANCELLED),
Proposal (PENDING|ACCEPTED|REJECTED, único projectId+developerId), Contract
(ACTIVE|COMPLETED|CANCELLED, agreedAmount, deadlineDays), Message (direta ou
por projectId do contrato), Delivery (PENDING|SUBMITTED|APPROVED|
REVISION_REQUESTED, description, link, notes), Review (rating 1–5, único
projectId+authorId), Payment (PENDING|PAID|RELEASED|FAILED, platformFee 10%,
developerAmount), Notification (type, message, read).
Enums viraram strings validadas (SQLite não suporta enums no Prisma 5).

## Pagamentos — PENDENTE DE CONFIGURAÇÃO (não fingido)
- `POST /api/payments/pix` → 503 `CONFIGURATION_PENDING` enquanto
  `MERCADOPAGO_ACCESS_TOKEN` não existir; com token, cria cobrança Pix
  (idempotency key por contrato) e salva `externalPaymentId`.
- `POST /api/webhooks/mercadopago` → valida assinatura HMAC
  (`MERCADOPAGO_WEBHOOK_SECRET`), consulta o pagamento no MP e move
  PENDING→PAID (nunca por via do cliente).
- **Escrow**: na aprovação da entrega (`/api/deliveries/[id]/approve`), se o
  pagamento estiver `PAID` ele vira `RELEASED` e o programador recebe
  notificação `PAYMENT_RELEASED`. Se não estiver pago, permanece `PENDING` —
  nada é liberado sem pagamento confirmado.
- UI: painel de pagamento mostra split (valor, comissão 10%, valor do
  programador), explicação do escrow, aviso claro "Pagamento pendente de
  configuração" + chave Pix da plataforma (`PLATFORM_PIX_KEY`).

## E-mails (integração gerenciada Emergent/Resend)
`lib/email.ts`: `EMERGENT_EMAIL_KEY` + `EMAIL_FROM_NAME="Code Pay"` no `.env`
(sem chave Resend do usuário). POST para
`https://integrations.emergentagent.com/api/v1/email/send` com `from_name`
obrigatório. Eventos: nova proposta, nova mensagem, nova entrega, entrega
aprovada, alteração solicitada — sempre só para o destinatário do evento.
Destinatário vem do banco, corpo de template fixo, `assertSafeEmail` em todo
envio.

**Arquitetura de envio (importante)**: o envio NUNCA acontece no caminho da
request. As funções de template enfileiram e retornam na hora; um worker drena
a fila em série com intervalo mínimo de 800ms entre envios e um retry após 5s
em caso de 429. Motivo: a primeira versão aguardava o provedor dentro da
request e cada mensagem de chat levava ~4,9s (medido); com a fila caiu para
~0,19s. O provedor tem cota por janela — se ela estourar, a ação do usuário
continua normal e o e-mail é apenas registrado/reenviado.

## Vitrine pública
`/developers` — pública, filtros por tecnologia, avaliação mínima, valor/hora
e disponibilidade.

## Segurança
Todas as APIs checam sessão + papel + propriedade; contrato/mensagens/entregas/
avaliações só para participantes (404/403); notificações e mensagens filtradas
por usuário; nenhuma resposta expõe passwordHash.

## Dados demo (isolados)
`npm run db:seed` cria apenas contas marcadas "(Demo)" — nenhuma tela funcional
depende deles. Credenciais em `memory/test_credentials.md`.
