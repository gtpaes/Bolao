const Ticket = require("../models/Ticket");
const Round = require("../models/Round");
const ScoreLog = require("../models/ScoreLog");
const Pick = require("../models/Pick");
const { scorePick, POINTS } = require("../utils/scoring");
const logger = require("../config/logger");

// Processa a pontuação de UMA rodada (idempotente por ScoreLog único).
async function processRoundScoring(roundId) {
  const round = await Round.findById(roundId);
  if (!round) return { processed: 0 };
  const finished = (round.matches || []).filter((m) => m.status === "finished" && m.homeScore != null && m.awayScore != null);
  if (!finished.length) return { processed: 0 };
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
      const points = scorePick(Number(pick.home), Number(pick.away), Number(match.homeScore), Number(match.awayScore), round.scoringRules || POINTS);
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
  return { processed, rules: round.scoringRules || POINTS };
}

async function getRanking(roundId) {
  let round = null;
  if (roundId) {
    round = await Round.findById(roundId).lean();
  }
  if (!round) {
    round = await Round.findOne({}).sort({ number: -1 }).lean();
  }
  if (!round) return { ranking: [], myPosition: null };
  const tickets = await Ticket.find({ roundId: round._id, status: { $in: ["released", "closed", "scored"] } })
    .populate("userId", "username")
    .lean();
  const ranking = tickets
    .filter((ticket) => Array.isArray(ticket.picks) && ticket.picks.length > 0)
    .map((t) => ({
      ticket_id: String(t._id),
      ticket_number: t.number,
      user_id: String(t.userId && t.userId._id ? t.userId._id : t.userId),
      username: (t.userId && t.userId.username) || "Usuário",
      points: Number(t.points) || 0,
    }))
    .sort((a, b) => b.points - a.points || a.username.localeCompare(b.username) || a.ticket_number - b.ticket_number)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
  return { ranking, myPosition: null, roundId: String(round._id) };
}

module.exports = { processRoundScoring, getRanking, POINTS };
