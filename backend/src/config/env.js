require("dotenv").config();

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function secret(name) {
  return String(process.env[name] || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

const footballProvider = process.env.FOOTBALL_PROVIDER || "football-data";
const footballBaseUrl = process.env.FOOTBALL_API_BASE_URL || (
  footballProvider === "football-data" ? "https://api.football-data.org/v4" : "https://api.api-futebol.com.br/v1"
);

const _nodeEnv = process.env.NODE_ENV || "development";

const config = {
  port: num("PORT", 3001),
  nodeEnv: _nodeEnv,
  frontendUrl: process.env.FRONTEND_URL || "",
  // Brevo (e-mail transacional) — usado no "esqueci minha senha".
  // apiUrl aponta para o endpoint oficial de envio; pode ser trocado por
  // BREVO_API_URL sem alterar o código.
  brevo: {
    apiKey: secret("BREVO_API_KEY"),
    fromEmail: String(process.env.BREVO_FROM_EMAIL || "").trim(),
    fromName: process.env.BREVO_FROM_NAME || "Bolão",
    apiUrl: process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email",
    timeoutMs: num("BREVO_TIMEOUT_MS", 10000),
  },
  // Dominio(s) permitido(s) pelo CORS.
  // - Se FRONTEND_URL for definido, usa só essas origens (separadas por vírgula).
  // - Se não for definido e o ambiente for produção, aceita qualquer origem (*).
  // - Em desenvolvimento, usa os origens de localhost por padrão.
  frontendOrigins: (
    process.env.FRONTEND_URL
      ? String(process.env.FRONTEND_URL)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : /* produção sem FRONTEND_URL explícito */ config.nodeEnv === "production"
        ? true
        : /* desenvolvimento */ ["http://localhost:8080", "http://localhost:5500", "http://127.0.0.1:5500"]
            .map((s) => s.trim())
            .filter(Boolean)
  ),
  mongodbUri: secret("MONGODB_URI"),
  jwtSecret: secret("JWT_SECRET") || "dev-secret-troque-em-producao",
  jwtExpiration: process.env.JWT_EXPIRATION || "8h",
  football: {
    provider: footballProvider,
    baseUrl: footballBaseUrl.replace(/\/$/, ""),
    apiKey: secret("FOOTBALL_API_KEY"),
    competitionCode: process.env.FOOTBALL_COMPETITION_CODE || "BSA",
    campeonatoId: num("FOOTBALL_CAMPEONATO_ID", 10),
    roundNumber: num("FOOTBALL_ROUND_NUMBER", 28),
    roundPollMinutes: Math.max(5, num("FOOTBALL_ROUND_POLL_MINUTES", 30)),
    // A cota da API-Futebol e limitada; nunca consultar ao vivo a cada 30s.
    // 10 minutos e o padrao, com piso de 5 minutos mesmo se o ambiente antigo
    // ainda estiver configurado com 30 segundos.
    livePollSeconds: Math.max(300, num("FOOTBALL_LIVE_POLL_SECONDS", 600)),
    matchDurationMinutes: num("FOOTBALL_MATCH_DURATION_MINUTES", 130),
    timeoutMs: num("FOOTBALL_TIMEOUT_MS", 10000),
    enabled: Boolean(process.env.FOOTBALL_API_KEY),
  },
  mp: {
    accessToken: secret("MP_ACCESS_TOKEN"),
    webhookSecret: secret("MP_WEBHOOK_SECRET"),
    sandbox: String(process.env.MP_SANDBOX || "true") === "true",
    enabled: Boolean(process.env.MP_ACCESS_TOKEN),
  },
  // Só um ambiente deve rodar os jobs (sync/ao-vivo/fechamento) contra o banco.
  enableSchedulers: String(process.env.ENABLE_SCHEDULERS || "true") === "true",
};

module.exports = config;
