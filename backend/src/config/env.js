require("dotenv").config();

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const config = {
  port: num("PORT", 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "",
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
  mongodbUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-troque-em-producao",
  jwtExpiration: process.env.JWT_EXPIRATION || "8h",
  football: {
    baseUrl: (process.env.FOOTBALL_API_BASE_URL || "https://api.api-futebol.com.br/v1").replace(/\/$/, ""),
    apiKey: process.env.FOOTBALL_API_KEY || "",
    campeonatoId: num("FOOTBALL_CAMPEONATO_ID", 10),
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
    accessToken: process.env.MP_ACCESS_TOKEN || "",
    webhookSecret: process.env.MP_WEBHOOK_SECRET || "",
    sandbox: String(process.env.MP_SANDBOX || "true") === "true",
    enabled: Boolean(process.env.MP_ACCESS_TOKEN),
  },
  // Só um ambiente deve rodar os jobs (sync/ao-vivo/fechamento) contra o banco.
  enableSchedulers: String(process.env.ENABLE_SCHEDULERS || "true") === "true",
};

module.exports = config;
