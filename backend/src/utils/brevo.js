/* utils/brevo.js — normalização dos valores do Brevo vindos do ambiente.

   O envio precisa SEMPRE cair no endpoint de e-mail transacional. Uma variável
   BREVO_API_URL apontando para a raiz da API (ex.: "https://api.brevo.com/v3/")
   fazia o POST bater numa rota inexistente, o Brevo responder erro e o mailer
   converter isso em 502 "não foi possível enviar o e-mail". */

const DEFAULT_URL = "https://api.brevo.com/v3/smtp/email";

/** Remove espaços e aspas que vêm colados do painel de variáveis. */
function unquote(value) {
  return String(value == null ? "" : value)
    .trim()
    .replace(/^['\"]|['\"]$/g, "")
    .trim();
}

/** Base (…/v3) ou URL completa, sempre devolve a URL de envio (…/smtp/email). */
function normalizeBrevoUrl(value) {
  const raw = unquote(value);
  if (!raw) return DEFAULT_URL;
  const semBarraFinal = raw.replace(/\/+$/, "");
  if (/\/smtp\/email$/i.test(semBarraFinal)) return semBarraFinal;
  return `${semBarraFinal}/smtp/email`;
}

module.exports = { unquote, normalizeBrevoUrl, DEFAULT_URL };