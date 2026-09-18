const config = require("../../config/env");
const logger = require("../../config/logger");

const BASE = config.football.baseUrl;
const TIMEOUT = config.football.timeoutMs;

function isFootballData() {
  return config.football.provider === "football-data";
}

function footballDataHeaders() {
  return { "X-Auth-Token": config.football.apiKey };
}

function footballDataStatus(status) {
  const value = String(status || "").toUpperCase();
  if (["LIVE", "IN_PLAY", "PAUSED"].includes(value)) return "andamento";
  if (["FINISHED"].includes(value)) return "encerrada";
  if (["POSTPONED", "SUSPENDED", "CANCELLED"].includes(value)) return "adiada";
  return "agendada";
}

function footballDataMatch(match) {
  const fullTime = match.score && match.score.fullTime || {};
  const halfTime = match.score && match.score.halfTime || {};
  const status = String(match.status || "").toUpperCase();
  return {
    partida_id: Number(match.id),
    campeonato: { campeonato_id: config.football.competitionCode },
    time_mandante: { nome_popular: match.homeTeam && match.homeTeam.name, escudo: match.homeTeam && match.homeTeam.crest },
    time_visitante: { nome_popular: match.awayTeam && match.awayTeam.name, escudo: match.awayTeam && match.awayTeam.crest },
    data_realizacao_iso: match.utcDate,
    status: status === "LIVE" || status === "IN_PLAY" || status === "PAUSED" ? "andamento" : status === "FINISHED" ? "finalizado" : footballDataStatus(status),
    placar_mandante: fullTime.home ?? halfTime.home ?? null,
    placar_visitante: fullTime.away ?? halfTime.away ?? null,
    disputa_penalti: false,
    estadio: { nome_popular: match.venue || "" },
  };
}

function footballDataRoundStatus(matches) {
  const statuses = matches.map((match) => String(match.status || "").toUpperCase());
  if (statuses.some((status) => ["LIVE", "IN_PLAY", "PAUSED"].includes(status))) return "andamento";
  if (statuses.length && statuses.every((status) => status === "FINISHED")) return "encerrada";
  return "agendada";
}

async function apiGet(path) {
  if (!config.football.apiKey) {
    const err = new Error("FOOTBALL_API_KEY não configurada.");
    err.status = 503;
    err.code = "FOOTBALL_DISABLED";
    throw err;
  }
  logger.debug({ path, keyConfigured: true }, "consultando API-Futebol");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: isFootballData() ? footballDataHeaders() : { Authorization: `Bearer ${config.football.apiKey}` },
      signal: ctrl.signal,
    });
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      logger.warn({ path, retryAfter }, "api-futebol rate limit");
    }
    if (!res.ok) {
      const err = new Error(`API-Futebol respondeu ${res.status} em ${path}. Verifique FOOTBALL_API_KEY e FOOTBALL_CAMPEONATO_ID no Render.`);
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
  if (isFootballData()) {
    const data = await apiGet(`/competitions/${config.football.competitionCode}/matches`);
    const grouped = new Map();
    for (const match of data.matches || []) {
      const number = Number(match.matchday);
      if (!Number.isFinite(number)) continue;
      if (!grouped.has(number)) grouped.set(number, []);
      grouped.get(number).push(match);
    }
    const numbers = [...grouped.keys()].sort((a, b) => a - b);
    return numbers.map((number, index) => ({
      nome: `${number}ª Rodada`, rodada: number, status: footballDataRoundStatus(grouped.get(number)),
      proxima_rodada: numbers[index + 1] ? { rodada: numbers[index + 1], status: footballDataRoundStatus(grouped.get(numbers[index + 1])) } : null,
    }));
  }
  const data = await apiGet(`/campeonatos/${campeonatoId}/rodadas`);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.rodadas)) return data.rodadas;
  if (data && Array.isArray(data.rounds)) return data.rounds;
  if (data && Number.isFinite(Number(data.rodada))) return [data];
  throw Object.assign(new Error("Formato inesperado da lista de rodadas."), { status: 502, code: "FOOTBALL_ERROR" });
}

// GET /campeonatos/{id}/rodadas/{rodada} — formato exato mapeado em runtime (ver syncRound).
async function getRoundDetail(campeonatoId = config.football.campeonatoId, rodada) {
  if (isFootballData()) {
    const data = await apiGet(`/competitions/${config.football.competitionCode}/matches?matchday=${Number(rodada)}`);
    const matches = (data.matches || []).map(footballDataMatch);
    return { nome: `${rodada}ª Rodada`, rodada: Number(rodada), status: footballDataRoundStatus(data.matches || []), partidas: matches };
  }
  return apiGet(`/campeonatos/${campeonatoId}/rodadas/${rodada}`);
}

// GET /ao-vivo -> [ partidas em andamento ] (filtrar por campeonato no sync).
async function listLive() {
  if (isFootballData()) {
    const data = await apiGet(`/competitions/${config.football.competitionCode}/matches?status=LIVE`);
    return (data.matches || []).map(footballDataMatch);
  }
  const data = await apiGet("/ao-vivo");
  if (!Array.isArray(data)) throw Object.assign(new Error("Formato inesperado do ao-vivo."), { status: 502, code: "FOOTBALL_ERROR" });
  return data;
}

module.exports = { listRounds, getRoundDetail, listLive };
