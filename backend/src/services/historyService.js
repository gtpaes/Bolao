const Ticket = require("../models/Ticket");
const Round = require("../models/Round");
const ScoreLog = require("../models/ScoreLog");

async function listHistory(userId, { roundId, status } = {}) {
  const query = { userId };
  if (roundId && roundId !== "all") query.roundId = roundId;
  if (status && status !== "all") query.status = status;
  const tickets = await Ticket.find(query).sort({ createdAt: -1 }).lean();
  if (!tickets.length) return { history: [] };

  const roundIds = [...new Set(tickets.map((ticket) => String(ticket.roundId)))];
  const [rounds, logs] = await Promise.all([
    Round.find({ _id: { $in: roundIds } }).lean(),
    ScoreLog.find({ ticketId: { $in: tickets.map((ticket) => ticket._id) } }).lean(),
  ]);
  const roundsById = new Map(rounds.map((round) => [String(round._id), round]));
  const logsByTicket = new Map();
  for (const log of logs) {
    const list = logsByTicket.get(String(log.ticketId)) || [];
    list.push(log);
    logsByTicket.set(String(log.ticketId), list);
  }

  return {
    history: tickets.map((ticket) => {
      const round = roundsById.get(String(ticket.roundId));
      const scoreLogs = logsByTicket.get(String(ticket._id)) || [];
      const matches = new Map((round && round.matches || []).map((match) => [Number(match.externalId), match]));
      return {
        ticket_id: String(ticket._id),
        ticket_number: ticket.number,
        round_id: String(ticket.roundId),
        round_number: round ? round.number : null,
        round_name: round ? round.name || "" : "",
        status: ticket.status,
        points: Number(ticket.points) || 0,
        created_at: ticket.createdAt,
        picks: (ticket.picks || []).map((pick) => {
          const log = scoreLogs.find((item) => Number(item.matchExternalId) === Number(pick.matchExternalId));
          const match = matches.get(Number(pick.matchExternalId));
          return {
            match_id: pick.matchExternalId,
            home_team: match ? match.home : "Mandante",
            away_team: match ? match.away : "Visitante",
            predicted: { home: pick.home, away: pick.away },
            actual: log ? log.actual : null,
            points: log ? log.points : Number(pick.points) || 0,
          };
        }),
      };
    }),
  };
}

module.exports = { listHistory };
