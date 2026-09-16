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

### Backend (Render)

O backend é um serviço Node.js persistente. Hospede-o em Render (ou similar) com as variáveis de ambiente:

- `PORT=3001`
- `NODE_ENV=production`
- `FRONTEND_URL=https://bolao-virid-seven.vercel.app` — origens permitidas pelo CORS. Deve incluir o domínio do frontend no Vercel.
- `MONGODB_URI=...`
- `JWT_SECRET=...`
- `FOOTBALL_API_KEY=...`
- `FOOTBALL_CAMPEONATO_ID=10`
- `ENABLE_SCHEDULERS=true` — só aqui os jobs de sync/ao-vivo/fechamento rodam automaticamente.
- `MP_ACCESS_TOKEN=...`, `MP_WEBHOOK_SECRET=...`, `MP_SANDBOX=true` (sandbox na primeira vez).

O backend roda `node src/server.js` (ou `npm start`). Ele serve tambem o frontend estático se `FRONTEND_DIR` for encontrado; mas para produção separada recomenda-se hospedar o frontend no Vercel e deixar o backend só como API.

### Frontend (Vercel)

O frontend é estático (HTML/JS/CSS). Hospede-o no Vercel (ou GitHub Pages/Render static) com a variável de ambiente que aponta para o backend:

- `API_BASE_URL=https://bolao-tgup.onrender.com/api` (ou o domínio do backend no Render).

Isso é usado pelo `client.js` para resolver a base da API quando o frontend não está na mesma origem do backend.

### CORS

Se o frontend no Vercel faz requisições para o backend no Render, o backend deve listar a origem do Vercel em `FRONTEND_URL`. Sem isso, o browser bloqueia por falta de `Access-Control-Allow-Origin`.

Exemplo de erro no console:
```
Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

Solucao: configure `FRONTEND_URL=https://bolao-virid-seven.vercel.app` no backend e reinicie o servico.

### Variáveis de ambiente (sumário)

| Variável | Onde | Exemplo |
|----------|------|---------|
| `PORT` | Backend | `3001` |
| `NODE_ENV` | Backend | `production` |
| `FRONTEND_URL` | Backend | `https://bolao-virid-seven.vercel.app` |
| `MONGODB_URI` | Backend | `mongodb+srv://...` |
| `JWT_SECRET` | Backend | `...` |
| `FOOTBALL_API_KEY` | Backend | `live_...` |
| `ENABLE_SCHEDULERS` | Backend | `true` (produção) / `false` (local) |
| `API_BASE_URL` | Frontend | `https://bolao-tgup.onrender.com/api` |

