/* Contrato do mailer (Brevo) e normalização das variáveis de ambiente.

   Fixa o comportamento que causou o 502 em produção: a URL tem de ser SEMPRE a do
   endpoint de envio (…/v3/smtp/email) e qualquer recusa do Brevo vira
   EMAIL_ERROR/502 — sem detalhe técnico na mensagem do usuário. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { unquote, normalizeBrevoUrl } = require("../src/utils/brevo");
const config = require("../src/config/env");
const logger = require("../src/config/logger");
const { sendEmail } = require("../src/services/mailer");

logger.level = "silent"; // os testes provocam falhas de propósito

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const base = { ...config.brevo };
const enviar = () => sendEmail({ to: "dest@exemplo.com", subject: "Assunto", html: "<p>oi</p>" });
function restore() {
  Object.assign(config.brevo, base);
  delete global.fetch;
}

test("a URL do Brevo é sempre a do endpoint de envio", () => {
  assert.equal(normalizeBrevoUrl("https://api.brevo.com/v3/"), BREVO_URL);
  assert.equal(normalizeBrevoUrl("https://api.brevo.com/v3"), BREVO_URL);
  assert.equal(normalizeBrevoUrl(BREVO_URL), BREVO_URL);
  assert.equal(normalizeBrevoUrl(""), BREVO_URL);
  assert.equal(normalizeBrevoUrl('  "https://api.brevo.com/v3/"  '), BREVO_URL);
});

test("unquote remove espaços e aspas coladas do painel", () => {
  assert.equal(unquote('  "x@y.com"  '), "x@y.com");
  assert.equal(unquote("'x@y.com'"), "x@y.com");
  assert.equal(unquote(null), "");
  assert.equal(unquote("x@y.com"), "x@y.com");
});

test("envio bem-sucedido bate na URL de envio com o header api-key", async () => {
  let chamada = null;
  try {
    Object.assign(config.brevo, { apiKey: "k", fromEmail: "de@exemplo.com", apiUrl: BREVO_URL });
    global.fetch = async (url, opts) => {
      chamada = { url, key: opts.headers["api-key"] };
      return { ok: true, status: 201, text: async () => JSON.stringify({ messageId: "abc" }) };
    };
    await enviar();
    assert.equal(chamada.url, BREVO_URL);
    assert.equal(chamada.key, "k");
  } finally { restore(); }
});

test("recusa do Brevo vira 502 EMAIL_ERROR sem detalhe técnico na mensagem", async () => {
  try {
    Object.assign(config.brevo, { apiKey: "k", fromEmail: "de@exemplo.com", apiUrl: BREVO_URL });
    global.fetch = async () => ({ ok: false, status: 404, text: async () => "{\"code\":\"not_found\"}" });
    await assert.rejects(enviar, (err) => {
      assert.equal(err.status, 502);
      assert.equal(err.code, "EMAIL_ERROR");
      assert.equal(err.message.includes("404"), false);
      assert.equal(err.message.includes("not_found"), false);
      return true;
    });
  } finally { restore(); }
});

test("sem chave/remetente o envio recusa como 503 sem chamar a API", async () => {
  let chamou = false;
  try {
    Object.assign(config.brevo, { apiKey: "", fromEmail: "" });
    global.fetch = async () => { chamou = true; return { ok: true, status: 200, text: async () => "{}" }; };
    await assert.rejects(enviar, (err) => {
      assert.equal(err.status, 503);
      assert.equal(err.code, "EMAIL_DISABLED");
      return true;
    });
    assert.equal(chamou, false);
  } finally { restore(); }
});