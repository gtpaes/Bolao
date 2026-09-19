# Recuperação de senha por e-mail (Brevo)

O e-mail de recuperação de senha sai pela API transacional do Brevo:
`POST https://api.brevo.com/v3/smtp/email` (endpoint oficial; pode ser trocado com `BREVO_API_URL`).
A autenticação é pelo header `api-key` — a chave fica **somente** no ambiente do servidor.

Variáveis no backend (Render):

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `BREVO_API_KEY` | sim | Chave da API (Brevo → SMTP & API → API Keys). |
| `BREVO_FROM_EMAIL` | sim | Remetente validado no Brevo (Senders & Domains). |
| `BREVO_FROM_NAME` | não | Nome exibido no remetente (padrão `Bolão`). |
| `FRONTEND_URL` | sim | Base do site, usada para montar `/reset-password.html?token=...`. |
| `BREVO_API_URL` | não | Sobrescreve o endpoint de envio. |
| `BREVO_TIMEOUT_MS` | não | Timeout do envio em ms (padrão `10000`). |

O remetente precisa estar validado no Brevo (verifique o e-mail em *Senders & Domains* ou autentique o domínio com DKIM).
Sem as chaves, a rota `/auth/recover` responde `503 EMAIL_DISABLED`; com chave inválida ou remetente não validado, responde `502 EMAIL_ERROR`
(o motivo exato fica no log do servidor: `brevo recusou o e-mail`).

# Bolão — Backend (Node.js + Express + MongoDB Atlas)
