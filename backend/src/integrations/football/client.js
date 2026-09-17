const config = require("../../config/env");
const logger = require("../../config/logger");

const BASE = config.football.baseUrl;
const TIMEOUT = config.football.timeoutMs;

async function apiGet(path) {
  if (!config.football.apiKey) {
    const err = new Error("FOOTBALL_API_KEY não configurada.");
    err.status = 503;
    err.code = "FOOTBALL_DISABLED";
    throw err;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${config.football.apiKey}` },
      signal: ctrl.signal,
    });
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      logger.warn({ path, retryAfter }, "api-futebol rate limit");
    }
    if (!res.ok) {
      const err = new Error(`API-Futebol respondeu ${res.status} em ${path}.`);
      err.status = 502;
      err.code = "FOOTBALL_ERROR";
      throw err;
    }
    return res.json();
  } catch (e) {
    if (e && e.code === "FOOTBALL_ERROR") throw e;
    const err = new Error(`Falha ao consultar a API de futebol (${path}).`);
    err.status = 502;
    err.code = "FOOTBALL_ERROR";
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// GET /campeonatos/{id}/rodadas -> [{ nome, slug, rodada, status, proxima_rodada, rodada_anterior, _link }]
async function listRounds(campeonatoId = config.football.campeonatoId) {
  const data = await apiGet(`/campeonatos/${campeonatoId}/rodadas`);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.rodadas)) return data.rodadas;
  if (data && Array.isArray(data.rounds)) return data.rounds;
  if (data && Number.isFinite(Number(data.rodada))) return [data];
  throw Object.assign(new Error("Formato inesperado da lista de rodadas."), { status: 502, code: "FOOTBALL_ERROR" });
}

// GET /campeonatos/{id}/rodadas/{rodada} — formato exato mapeado em runtime (ver syncRound).
async function getRoundDetail(campeonatoId = config.football.campeonatoId, rodada) {
  return apiGet(`/campeonatos/${campeonatoId}/rodadas/${rodada}`);
}

// GET /ao-vivo -> [ partidas em andamento ] (filtrar por campeonato no sync).
async function listLive() {
  const data = await apiGet("/ao-vivo");
  if (!Array.isArray(data)) throw Object.assign(new Error("Formato inesperado do ao-vivo."), { status: 502, code: "FOOTBALL_ERROR" });
  return data;
}

module.exports = { listRounds, getRoundDetail, listLive };
