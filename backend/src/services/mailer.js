const config = require("../config/env");
const logger = require("../config/logger");

// Envio de e-mail transacional via Brevo.
// Endpoint oficial: POST https://api.brevo.com/v3/smtp/email
// O Brevo autentica pelo header "api-key" (não é Bearer).
async function sendEmail({ to, toName, subject, html }) {
  if (!config.brevo.apiKey || !config.brevo.fromEmail) {
    const err = new Error("Envio de e-mail não configurado.");
    err.status = 503;
    err.code = "EMAIL_DISABLED";
    throw err;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.brevo.timeoutMs);
  try {
    const response = await fetch(config.brevo.apiUrl, {
      method: "POST",
      headers: {
        "api-key": config.brevo.apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: config.brevo.fromEmail, name: config.brevo.fromName },
        to: [toName ? { email: to, name: String(toName).slice(0, 70) } : { email: to }],
        subject,
        htmlContent: html,
      }),
      signal: ctrl.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      // Casos comuns: 401 (chave inválida), 400 (remetente não validado) e
      // 404 (URL errada). A URL entra no log para o diagnóstico ser imediato.
      logger.error({ status: response.status, url: config.brevo.apiUrl, body: raw.slice(0, 500) }, "brevo recusou o e-mail");
      throw emailError();
    }
    logger.info({ to, messageId: messageIdOf(raw) }, "e-mail transacional enviado (brevo)");
  } catch (e) {
    if (e && e.code === "EMAIL_ERROR") throw e;
    logger.error({ err: String(e && e.message), url: config.brevo.apiUrl }, "falha ao enviar e-mail pelo brevo");
    throw emailError();
  } finally {
    clearTimeout(timer);
  }
}

// 502 é o "serviço de e-mail falhou": o detalhe técnico fica SÓ no log (acima),
// nunca na resposta. A mensagem diz o que o usuário pode fazer.
function emailError() {
  const err = new Error("Não foi possível enviar o e-mail de recuperação agora. Tente novamente em alguns minutos.");
  err.status = 502;
  err.code = "EMAIL_ERROR";
  return err;
}

function messageIdOf(raw) {
  try { return JSON.parse(raw).messageId || null; } catch (e) { return null; }
}

async function sendPasswordResetEmail({ to, username, token }) {
  if (!config.frontendUrl) {
    const err = new Error("FRONTEND_URL não configurada para montar o link de recuperação.");
    err.status = 503;
    err.code = "EMAIL_DISABLED";
    throw err;
  }
  const resetUrl = `${config.frontendUrl.replace(/\/$/, "")}/reset-password.html?token=${encodeURIComponent(token)}`;
  const html = [
    `<p>Olá, ${escapeHtml(username) || "jogador"}.</p>`,
    "<p>Use o link abaixo para criar uma nova senha. Ele expira em 30 minutos.</p>",
    `<p><a href="${escapeHtml(resetUrl)}">Redefinir senha</a></p>`,
    "<p>Se você não solicitou, ignore este e-mail.</p>",
  ].join("");
  await sendEmail({ to, toName: username, subject: "Redefinição de senha do Bolão", html });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}

module.exports = { sendEmail, sendPasswordResetEmail };
