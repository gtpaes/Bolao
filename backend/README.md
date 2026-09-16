# Bolão — Backend (Node.js + Express + MongoDB Atlas)

API do bolão de futebol. O frontend em `../frontend` consome estes endpoints via `baseURL /api` com `Authorization: Bearer <JWT>`.

## Requisitos

- Node.js 20+
- MongoDB Atlas (string de conexão)
- API-Futebol (https://dash.api-futebol.com.br) — `FOOTBALL_API_KEY`, `FOOTBALL_CAMPEONATO_ID=10`
- Mercado Pago — `MP_ACCESS_TOKEN` (sandbox primeiro), `MP_WEBHOOK_SECRET`

## Configuração

```bash
cp .env.example .env
# preencha MONGODB_URI, JWT_SECRET, FOOTBALL_API_KEY, MP_ACCESS_TOKEN...
npm install
npm run dev
```

- API: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/api-docs`
- Health: `GET /api/health`

## Rodar em localhost (frontend + backend juntos)

O backend serve o próprio frontend (mesma origem, sem CORS):

```bash
cp .env.example .env   # preencha MONGODB_URI (Atlas) e JWT_SECRET
npm install
npm run seed           # cria as contas dev@bolao.local / admin@bolao.local no banco
npm run dev
```

Abra **http://localhost:3001** → abre em `login.html`. O `client.js` do frontend resolve a base da API automaticamente (`/api` na porta 3001; `http://localhost:3001/api` fora dela). Se servir o frontend por outro servidor (Live Server etc.), adicione a origem em `FRONTEND_URL` no `.env`.

Fluxo: `login.html` → `POST /api/auth/login` (JWT) → `index.html` → dashboard consome `GET /api/rounds/current`, `/api/matches`, `/api/tickets`, `/api/ranking`.

Contas de acesso (criadas pelo seed, configuráveis via `DEV_EMAIL/DEV_PASSWORD` e `ADMIN_EMAIL/ADMIN_PASSWORD` no `.env`):

- `dev@bolao.local` / `dev12345` — papel `dev` (acesso total)
- `admin@bolao.local` / `admin12345` — papel `admin`

## Regras principais

- Pontuação 10/6/4/0 calculada só no servidor (`src/utils/scoring.js` + `ScoreLog` idempotente).
- Palpites travados por `round.deadline` + `round.status` + jogo iniciado (403 `ROUND_CLOSED` / `MATCH_STARTED`).
- Pagamento Pix só aprovado via webhook do Mercado Pago (assinatura validada + `webhookEventId` único). Frontend nunca aprova sozinho.
- Rodada automática: scheduler sincroniza `GET /campeonatos/10/rodadas` → detalhe da rodada → salva jogos; `proxima_rodada` avança; `ao-vivo` (30s, filtrado pelo campeonato 10) atualiza placares. Admin só edita o `deadline`.
- Sem carteira/saldo: Pix direto por compra.

## Testes

```bash
npm test
```

Cobre pontuação, escolha da rodada no sync e trava de fechamento (mocks só nos testes).

## Deploy

- `Dockerfile` incluído; variáveis todas via ambiente; HTTPS e domínio no provedor.
- Produção: gere novas chaves (as de teste não devem ir para produção).
