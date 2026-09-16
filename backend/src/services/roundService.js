const Round = require("../models/Round");

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
  const round = await Round.findOne({ status: { $in: ["open", "closed", "finished"] } }).sort({ number: -1 }).lean();
  if (round) return toRoundDTO(round);
  const latest = await Round.findOne({}).sort({ number: -1 }).lean();
  return toRoundDTO(latest);
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
    // Inclui "finished": uma rodada recém-terminada (todos finalizados) ainda
    // é a "atual" até o próximo sync abrir a seguinte. Excluir "finished" aqui
    // faz o sistema cair na rodada 4 antiga e esconder os resultados.
    round = await Round.findOne({ status: { $in: ["open", "closed", "finished"] } }).sort({ number: -1 }).lean();
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
