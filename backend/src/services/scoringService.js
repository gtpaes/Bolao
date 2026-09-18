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
      const points = scorePick(Number(pick.home), Number(pick.away), Number(match.homeScore), Number(match.awayScore));
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
  return { processed, rules: POINTS };
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
  const byUser = new Map();
  for (const t of tickets) {
    const uid = String(t.userId && t.userId._id ? t.userId._id : t.userId);
    const name = (t.userId && t.userId.username) || "Usuário";
    const cur = byUser.get(uid) || { user_id: uid, username: name, points: 0, tickets: 0 };
    cur.points += Number(t.points) || 0;
    cur.tickets += 1;
    byUser.set(uid, cur);
  }
  const ranking = [...byUser.values()].sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));
  return { ranking, myPosition: null, roundId: String(round._id) };
}

module.exports = { processRoundScoring, getRanking, POINTS };
