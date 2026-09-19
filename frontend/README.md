# Code Pay — MVP funcional

**"Mais que código, é oportunidade."**

Marketplace brasileiro que conecta clientes a programadores/freelancers.
Next.js 14 (App Router) + TypeScript + Prisma 5 + SQLite.

## Relatório final da finalização do MVP

### 1. Funcionalidades que já existiam (preservadas)

- Cadastro (CLIENT/DEVELOPER) com bcrypt, e-mail único; login/logout com sessão
  JWT em cookie httpOnly (`lib/auth.ts`); proteção de rotas por papel em
  `middleware.ts` com re-validação server-side em cada API.
- Publicação de projetos (CLIENT), listagem/busca de projetos abertos, página
  de detalhe do projeto.
- Envio de proposta com validações (sem duplicidade, projeto aberto).
- Aceite de proposta transacional (proposta aceita, demais rejeitadas, projeto
  IN_PROGRESS, Contract criado em uma única transação).
- Dashboards com números reais; `lib/fees.ts` (comissão 10%) e
  `lib/payments.ts` (registro Payment PENDING com split).

### 2. Funcionalidades implementadas nesta fase

- **Vitrine pública de programadores** (`/developers`): lista pública (sem
  login) com filtros por tecnologia, avaliação mínima, valor/hora máximo e
  disponibilidade; ordenada por nota. O CTA "Encontrar programador" da home
  agora aponta para ela.
- **Retenção e liberação automática (escrow)**: o valor do contrato fica
  retido e os 90% do programador passam a `RELEASED` automaticamente quando o
  cliente aprova a entrega — **somente** se o pagamento estiver confirmado
  (`PAID`). Sem pagamento confirmado o registro permanece `PENDING` e nada é
  liberado (verificado em teste: `released=false`).
- **E-mails transacionais** (integração gerenciada da Emergent/Resend, sem
  chave do usuário): nova proposta → cliente; nova mensagem → a outra parte;
  nova entrega → cliente; entrega aprovada → programador; alteração
  solicitada → programador. Destinatários vêm sempre do banco e os corpos de
  templates fixos no servidor (`lib/email.ts`), com gate de segurança
  (`assertSafeEmail`). O envio é assíncrono: as rotas enfileiram e respondem
  na hora, e um worker drena a fila com espaçamento + retry em caso de 429 —
  uma falha de e-mail nunca atrasa nem quebra a ação do usuário.
- **Perfil do programador** (`/profile`): foto (upload real para
  `public/uploads`), nome, título, bio, localização, disponibilidade, valor
  por hora, tecnologias, especialidades, portfólio + botão "Salvar perfil".
- **Perfil público** (`/developers/[id]`): foto, nome, título, bio, tecnologias,
  especialidades, portfólio, projetos realizados, avaliação média, quantidade
  de avaliações, disponibilidade, valor/hora + botões "Contratar" e
  "Enviar mensagem". Acessível a partir das propostas.
- **Projetos**: edição (PATCH `/api/projects/[id]` + `/projects/[id]/edit`) e
  cancelamento (POST `/api/projects/[id]/cancel`) pelo dono, quando permitido.
- **Busca com filtros**: categoria, tecnologia, orçamento mín/máx, prazo
  máximo e status.
- **Propostas**: rejeição (POST `/api/proposals/[id]/reject`) + cartão de
  proposta com dados do programador para comparação.
- **Contratação**: ao aceitar, cria contrato com prazo, cria Payment com split
  (10% Code Pay / 90% programador) e notifica aceites/rejeitados.
- **Contrato** (`/contracts/[id]`): projeto, cliente, programador, valor,
  prazo, status, data, chat, entregas, pagamento (split) e avaliação. Somente
  participantes acessam (página e APIs).
- **Chat real** (banco de dados, polling 5s): histórico, remetente, data/hora;
  somente participantes do contrato.
- **Entregas**: descrição, link e observações; status PENDING / SUBMITTED /
  APPROVED / REVISION_REQUESTED.
- **Aprovação**: "Aprovar entrega" (conclui contrato + projeto quando não
  restam etapas abertas) e "Solicitar alteração" (feedback registrado como
  mensagem no chat + notificação; permite nova entrega).
- **Avaliação**: nota 1–5 + comentário após conclusão; média e contagem
  recalculadas automaticamente no perfil; único por contrato.
- **Notificações**: sino no cabeçalho com contagem de não lidas (polling 15s),
  dropdown, página `/notifications` e "marcar todas como lidas". Eventos: nova
  proposta, proposta aceita/rejeitada, novo contrato, nova mensagem, nova
  entrega, entrega aprovada, solicitação de alteração, projeto concluído,
  projeto cancelado, nova avaliação.
- **Dashboards**: cliente (publicados, em andamento, propostas recebidas,
  concluídos, contratos ativos, entregas para aprovar, notificações) e
  programador (enviadas, aceitas, contratos ativos, concluídos, entregas
  aguardando aprovação, nota média, notificações). Tudo do banco.
- **Segurança**: auditoria de todas as APIs — sessão obrigatória, checagem de
  papel e propriedade (projetos, propostas, contratos, mensagens, entregas,
  avaliações, notificações); 404 para não-participantes de contrato; nenhuma
  senha/hash exposto em respostas.
- **Responsividade**: grids fluidos (auto-fit), formulários empilhados no
  mobile, header com wrap.

### 3–4. Arquivos criados / modificados

Criados: `app/api/profile/photo`, `app/api/projects/[id]/cancel`,
`app/api/proposals/[id]/reject`, `app/api/contracts` (+`[id]`, `messages`,
`deliveries`, `review`), `app/api/deliveries/[id]/approve` e `.../revision`,
`app/api/notifications`, `app/api/messages`, `app/api/payments/pix`,
`app/api/webhooks/mercadopago`, `lib/notify.ts`, `lib/labels.ts`,
`components/` (Avatar, NotificationBell, Chat, ProposalActions,
ProjectOwnerActions, DeliveryPanel, ReviewPanel, PixPaymentPanel, ProfileForm,
EditProjectForm, NewMessageForm, MarkAllReadButton), páginas `profile`,
`developers/[id]`, `contracts` (+`[id]`), `notifications`, `messages`
(+`new`), `projects/[id]/edit`.

Modificados: `prisma/schema.prisma`, `middleware.ts`, `lib/payments.ts`,
`app/api/profile`, `app/api/projects/[id]`, `app/api/proposals/[id]/accept`,
`app/api/auth/login|register`, `app/AppHeader`, `app/projects` (list/detail),
dashboards, `app/globals.css`, `prisma/seed.ts`, `package.json`.

### 5. Banco de dados (Prisma + SQLite, `prisma/dev.db`)

User, DeveloperProfile (photoUrl, ratingAvg, ratingCount), Project, Proposal
(único por projeto+programador), Contract (+deadlineDays), Message, Delivery
(+notes), Review (único por projeto+autor), Payment (split 10/90), Notification.
Status como strings validadas (SQLite não suporta enums nativos no Prisma 5 —
bug latente do zip original, corrigido).

### 6. APIs criadas ou modificadas

Criadas: `POST /api/profile/photo`, `PATCH /api/projects/[id]`,
`POST /api/projects/[id]/cancel`, `POST /api/proposals/[id]/reject`,
`GET /api/contracts`, `GET /api/contracts/[id]`,
`GET|POST /api/contracts/[id]/messages`, `POST /api/contracts/[id]/deliveries`,
`POST /api/contracts/[id]/review`, `POST /api/deliveries/[id]/approve`,
`POST /api/deliveries/[id]/revision`, `GET|POST /api/notifications`,
`GET|POST /api/messages`, `POST /api/payments/pix`,
`POST /api/webhooks/mercadopago`.
Modificadas: `PUT /api/profile` (nome + foto), `PATCH /api/projects/[id]`,
aceite de proposta (payment + prazo + notificações).

### 7–8. Problemas encontrados e corrigidos

- `prisma generate`/`build` falhavam: **SQLite não suporta enums no Prisma 5**
  (o zip original nunca tinha sido compilado). Conversão para strings
  validadas.
- **Aceite de proposta retornava 500 (Prisma P2028)**: as notificações eram
  criadas com o client global *dentro* de `$transaction`, abrindo uma segunda
  conexão que travava no lock de escrita do SQLite → timeout de 5s → rollback.
  Agora toda escrita dentro de transação usa o `tx`. Afetava aceite de
  proposta, aprovação de entrega e cancelamento de projeto.
- **`/api/*` não chegava ao app pelo domínio público**: o ingress da plataforma
  encaminha `/api/*` para o serviço da porta 8001 e as páginas para a 3000.
  `backend/server.py` passou a atuar como gateway, repassando `/api/*` para o
  servidor Next (preservando cookies/Set-Cookie e status).
- Import relativo quebrado para `AppHeader` em `projects/[id]/edit`.
- `contract.deliveries` não existe no modelo (entregas pertencem ao projeto) —
  include corrigido.
- `createSessionToken` exigia narrowing de `user.role` após a mudança de tipos.
- Páginas de projeto/lista/perfil público não tinham navegação nem "Sair"
  quando logado — passaram a usar o `AppHeader` (sino + menu + logout).
- `npm run build` no mesmo diretório do `next dev` corrompe `.next`: pare o
  dev server (ou use outro diretório) antes de buildar.

### 9. Resultado do build

`npm run build` e `tsc --noEmit` (`yarn typecheck`) passam sem erros.
`npm run dev` sobe em `http://localhost:3000` (supervisor: programa
`frontend`, diretório `/app/frontend`).

### 10. Como iniciar

```bash
npm install         # dependências
npm run db:push     # cria o SQLite
npm run db:seed     # opcional: DEMO data claramente marcada
npm run dev         # http://localhost:3000
```

### 11. O que depende de configuração externa

**Pagamento real (Mercado Pago / Pix)**: a arquitetura está pronta
(`POST /api/payments/pix` + webhook assinado em
`/api/webhooks/mercadopago`), mas **nenhum pagamento é simulado como
concluído**. A UI exibe "Pagamento pendente de configuração" enquanto
`MERCADOPAGO_ACCESS_TOKEN` (e `MERCADOPAGO_WEBHOOK_SECRET`) não forem
configurados no `.env`. A chave Pix da plataforma
(`PLATFORM_PIX_KEY`) é exibida apenas como informação de recebimento.
Comissão Code Pay: **10%** (`lib/fees.ts`).
