const Round = require("../models/Round");
const { syncRound } = require("../integrations/football/sync");
const config = require("../config/env");
const logger = require("../config/logger");

let lastApiSyncAt = 0;
let currentSyncPromise = null;

async function syncCurrentRound() {
  const ttlMs = config.football.roundPollMinutes * 60 * 1000;
  if (Date.now() - lastApiSyncAt < ttlMs) return null;
  if (currentSyncPromise) return currentSyncPromise;

  currentSyncPromise = syncRound()
    .then((result) => {
      lastApiSyncAt = Date.now();
      return result;
    })
    .finally(() => {
      currentSyncPromise = null;
    });
  return currentSyncPromise;
}

// Data da rodada = início do jogo mais cedo com data divulgada.
// Jogos sem data (a definir) ficam de fora; se nenhum tiver data, retorna null.
function roundStartDate(matches) {
  let best = null;
  for (const m of matches || []) {
    if (!m || !m.startsAt) continue;
    const t = new Date(m.startsAt).getTime();
    if (!Number.isFinite(t)) continue;
    if (best === null || t < best) best = t;
  }
  return best === null ? null : new Date(best);
}

function toRoundDTO(r) {
  if (!r) return null;
  const o = typeof r.toObject === "function" ? r.toObject() : r;
  return {
    id: String(o._id),
    number: o.number,
    name: o.name,
    slug: o.slug,
    status: o.status,
    providerStatus: o.providerStatus,
    date: roundStartDate(o.matches),
    deadline: o.deadline,
    syncedAt: o.syncedAt,
  };
}

function toMatchDTO(m) {
  const o = typeof m.toObject === "function" ? m.toObject() : m;
  const live = o.status === "live";
  return {
    id: o.externalId != null ? String(o.externalId) : String(o._id || ""),
    externalId: o.externalId,
    home: o.home,
    away: o.away,
    home_crest: o.homeCrest || "",
    away_crest: o.awayCrest || "",
    date: o.startsAt,
    status: o.status,
    live,
    home_score: o.homeScore,
    away_score: o.awayScore,
  };
}

// Prioriza a rodada mais recente de QUALQUER status (open/closed/finished).
// IMPORTANTE: incluir "finished" — quando a rodada atual termina (todos os
// jogos finalizados) o sync marca "finished"; se o filtro excluir "finished",
// o sistema cai numa rodada antiga (ex. rodada 4) e perde os resultados reais.
// A prioridade natural vem do `sort({ number: -1 })`: open > closed > finished
// só existem enquanto houver rodadas; a mais recente sempre vence.
async function getCurrentRound() {
  // A API-Futebol define a rodada atual. O sync mantem o mesmo registro no
  // banco para que tickets e palpites continuem vinculados a essa rodada.
  let synced = null;
  try {
    synced = await syncCurrentRound();
  } catch (e) {
    logger.warn({ err: String(e && e.message) }, "falha ao sincronizar rodada; usando cache do banco");
  }
  const round = synced && synced.round != null
    ? await Round.findOne({ number: synced.round }).lean()
    : await Round.findOne({ status: { $in: ["open", "closed", "finished"] } }).sort({ number: -1 }).lean();
  return toRoundDTO(round);
}

async function listRounds() {
  const rounds = await Round.find({}).sort({ number: -1 }).lean();
  return rounds.map(toRoundDTO);
}

async function getRound(id) {
  const round = await Round.findById(id).lean();
  return toRoundDTO(round);
}

async function listMatches(roundId) {
  let round = null;
  if (roundId) {
    round = await Round.findById(roundId).lean();
  }
  if (!round) {
    // Sem uma rodada explicita, sincroniza a rodada atual diretamente da API.
    let synced = null;
    try {
      synced = await syncCurrentRound();
    } catch (e) {
      logger.warn({ err: String(e && e.message) }, "falha ao sincronizar jogos; usando cache do banco");
    }
    round = synced && synced.round != null
      ? await Round.findOne({ number: synced.round }).lean()
      : await Round.findOne({ status: { $in: ["open", "closed", "finished"] } }).sort({ number: -1 }).lean();
  }
  if (!round) return [];
  return (round.matches || []).map(toMatchDTO);
}

async function listLive() {
  const rounds = await Round.find({ status: { $in: ["open", "closed"] }, "matches.status": "live" })
    .sort({ number: -1 })
    .limit(3)
    .lean();
  const out = [];
  for (const r of rounds) {
    for (const m of r.matches || []) {
      if (m.status === "live") out.push(toMatchDTO(m));
    }
  }
  return out;
}

module.exports = { getCurrentRound, listRounds, getRound, listMatches, listLive, toRoundDTO, toMatchDTO };
