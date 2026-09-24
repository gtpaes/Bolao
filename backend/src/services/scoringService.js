const Ticket = require("../models/Ticket");
const Round = require("../models/Round");
const ScoreLog = require("../models/ScoreLog");
const Pick = require("../models/Pick");
const { scorePick, POINTS } = require("../utils/scoring");
const { getScoringRules } = require("./settingsService");
const { badRequest } = require("../utils/errors");
const { Types } = require("mongoose");
const logger = require("../config/logger");

// Processa a pontuação de UMA rodada (idempotente por ScoreLog único).
async function processRoundScoring(roundId) {
  const round = await Round.findById(roundId);
  if (!round) return { processed: 0 };
  const finished = (round.matches || []).filter((m) => m.status === "finished" && m.homeScore != null && m.awayScore != null);
  if (!finished.length) return { processed: 0 };
  // Regras globais (Configurações) — a mesma pontuação vale para todas de rodadas.
  const rules = await getScoringRules();
  const tickets = await Ticket.find({ roundId: round._id, status: { $in: ["released", "closed", "scored"] } });
  let processed = 0;
  for (const ticket of tickets) {
    let changed = false;
    for (const pick of ticket.picks || []) {
      const match = finished.find((m) => Number(m.externalId) === Number(pick.matchExternalId));
      if (!match) continue;
      const exists = await ScoreLog.findOne({ ticketId: ticket._id, matchExternalId: Number(pick.matchExternalId) }).lean();
      if (exists) {
        await Pick.updateOne(
          { ticketId: ticket._id, matchExternalId: Number(pick.matchExternalId) },
          { $set: { points: exists.points } }
        );
        continue;
      }
      const points = scorePick(Number(pick.home), Number(pick.away), Number(match.homeScore), Number(match.awayScore), rules);
      pick.points = points;
      await ScoreLog.create({
        roundId: round._id,
        ticketId: ticket._id,
        matchExternalId: Number(pick.matchExternalId),
        predicted: { home: Number(pick.home), away: Number(pick.away) },
        actual: { home: Number(match.homeScore), away: Number(match.awayScore) },
        points,
      });
      await Pick.updateOne(
        { ticketId: ticket._id, matchExternalId: Number(pick.matchExternalId) },
        { $set: { points } }
      );
      changed = true;
      processed += 1;
    }
    if (changed) {
      ticket.points = (ticket.picks || []).reduce((s, p) => s + (Number(p.points) || 0), 0);
      if (ticket.status === "released") ticket.status = "scored";
      await ticket.save();
    }
  }
  logger.info({ round: round.number, processed }, "pontuação processada");
  return { processed, rules };
}

// Varre todas as rodadas e recalcula a pontuação de jogos já finalizados.
// Corrige o bug em que rodadas antigas ficavam sem pontuação quando a rodada
// atual avançava (pickTargetRound ignora rodadas já finalizadas).
async function scoreFinishedRounds() {
  const rounds = await Round.find({ "matches.status": "finished" }).lean();
  let totalProcessed = 0;
  for (const round of rounds) {
    const result = await processRoundScoring(round._id);
    totalProcessed += result.processed || 0;
  }
  logger.info({ rounds: rounds.length, processed: totalProcessed }, "pontuação de rodadas finalizadas");
  return { rounds: rounds.length, processed: totalProcessed };
}

// Monta o ranking de UMA rodada, ordenado por pontos. Fica isolado porque a
// página mostra a rodada atual E a anterior.
async function rankingForRound(round) {
  if (!round) return [];
  const tickets = await Ticket.find({ roundId: round._id, status: { $in: ["released", "closed", "scored"] } })
    .populate("userId", "username")
    .lean();
  return tickets
    .filter((ticket) => Array.isArray(ticket.picks) && ticket.picks.length > 0)
    .map((t) => ({
      ticket_id: String(t._id),
      ticket_number: t.number,
      user_id: String(t.userId && t.userId._id ? t.userId._id : t.userId),
      username: (t.userId && t.userId.username) || (t.ownerName && t.ownerName.trim()) || "Usuário",
      points: Number(t.points) || 0,
    }))
    .sort((a, b) => b.points - a.points || a.username.localeCompare(b.username) || a.ticket_number - b.ticket_number)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

// Rodada do ranking: a informada (id validado) ou, sem ela, a mais recente.
async function resolveRankingRound(roundId) {
  if (roundId) {
    if (!Types.ObjectId.isValid(String(roundId))) throw badRequest("Rodada inválida.");
    const byId = await Round.findById(String(roundId)).lean();
    if (byId) return byId;
  }
  return Round.findOne({}).sort({ number: -1 }).lean();
}

// Quantos tickets COM palpites cada rodada tem (uma consulta só). Serve para a
// escolha da rodada anterior sem varrer o banco rodada a rodada.
async function ticketCountByRound() {
  const rows = await Ticket.aggregate([
    { $match: { status: { $in: ["released", "closed", "scored"] }, "picks.0": { $exists: true } } },
    { $group: { _id: "$roundId", tickets: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.tickets]));
}

// Qual rodada entra na seção "rodada anterior": a mais recente ANTES da atual que
// tenha apostas (para a seção não nascer vazia por causa de rodada sem palpites);
// sem nenhuma com apostas, cai na imediatamente anterior. Função pura: dá para
// testar sem banco (a lista traz `tickets` = tickets com palpites).
function pickPreviousRound(rounds, currentNumber) {
  const ordered = (rounds || [])
    .filter((round) => round && Number.isFinite(Number(round.number)) && Number(round.number) < Number(currentNumber))
    .sort((a, b) => Number(b.number) - Number(a.number));
  return ordered.find((round) => Number(round.tickets) > 0) || ordered[0] || null;
}

async function getRanking(roundId) {
  const round = await resolveRankingRound(roundId);
  if (!round) return { round: null, roundId: null, ranking: [], myPosition: null };
  return {
    round: { id: String(round._id), number: round.number, status: round.status },
    roundId: String(round._id),
    ranking: await rankingForRound(round),
    myPosition: null,
  };
}

// Ranking da rodada anterior à informada (ou à atual), para a segunda seção da
// página de Ranking. Devolve { round, ranking } — round null quando não há.
async function getPreviousRanking(roundId) {
  const base = await resolveRankingRound(roundId);
  if (!base) return { round: null, ranking: [] };
  const candidates = await Round.find({ number: { $lt: base.number } }).select("number status").lean();
  const counts = await ticketCountByRound();
  const previous = pickPreviousRound(
    candidates.map((round) => ({ ...round, tickets: counts.get(String(round._id)) || 0 })),
    base.number,
  );
  if (!previous) return { round: null, ranking: [] };
  return {
    round: { id: String(previous._id), number: previous.number, status: previous.status },
    ranking: await rankingForRound(previous),
  };
}

module.exports = { processRoundScoring, getRanking, getPreviousRanking, pickPreviousRound, POINTS, scoreFinishedRounds };
