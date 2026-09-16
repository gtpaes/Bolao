require("dotenv").config();

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const config = {
  port: num("PORT", 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:8080",
  // Origens permitidas para CORS (separadas por vírgula).
  frontendOrigins: String(process.env.FRONTEND_URL || "http://localhost:8080,http://localhost:5500,http://127.0.0.1:5500")
    .split(",").map((s) => s.trim()).filter(Boolean),
  mongodbUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-troque-em-producao",
  jwtExpiration: process.env.JWT_EXPIRATION || "8h",
  football: {
    baseUrl: (process.env.FOOTBALL_API_BASE_URL || "https://api.api-futebol.com.br/v1").replace(/\/$/, ""),
    apiKey: process.env.FOOTBALL_API_KEY || "",
    campeonatoId: num("FOOTBALL_CAMPEONATO_ID", 10),
    roundPollMinutes: Math.max(5, num("FOOTBALL_ROUND_POLL_MINUTES", 30)),
    livePollSeconds: Math.max(30, num("FOOTBALL_LIVE_POLL_SECONDS", 30)),
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
};

module.exports = config;
