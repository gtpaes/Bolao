const authService = require("../services/authService");
const Ticket = require("../models/Ticket");
const Round = require("../models/Round");

async function me(req, res) {
  return res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role,
    createdAt: req.user.createdAt || null,
  });
}

async function update(req, res, next) {
  try { return res.json({ user: await authService.updateProfile(req.user.id, req.body || {}) }); }
  catch (e) { return next(e); }
}

async function password(req, res, next) {
  try { await authService.changePassword(req.user.id, req.body || {}); return res.json({ ok: true }); }
  catch (e) { return next(e); }
}

async function stats(req, res, next) {
  try {
    const tickets = await Ticket.find({ userId: req.user.id, status: { $in: ["released", "closed", "scored"] } }).lean();
    const roundIds = [...new Set(tickets.map((ticket) => String(ticket.roundId)))];
    let bestPosition = null;
    for (const roundId of roundIds) {
      const all = await Ticket.find({ roundId, status: { $in: ["released", "closed", "scored"] }, "picks.0": { $exists: true } }).select("userId points").lean();
      const sorted = all.sort((a, b) => (b.points || 0) - (a.points || 0));
      const own = tickets.filter((ticket) => String(ticket.roundId) === roundId);
      for (const ticket of own) {
        const position = sorted.findIndex((entry) => String(entry._id) === String(ticket._id)) + 1;
        if (position > 0 && (bestPosition == null || position < bestPosition)) bestPosition = position;
      }
    }
    const rounds = await Round.find({ _id: { $in: roundIds } }).select("number").lean();
    const bestTicket = tickets.reduce((best, ticket) => !best || (ticket.points || 0) > (best.points || 0) ? ticket : best, null);
    const bestRound = bestTicket ? rounds.find((round) => String(round._id) === String(bestTicket.roundId)) : null;
    return res.json({ stats: { tickets: tickets.length, points: bestTicket ? bestTicket.points || 0 : 0, rounds: bestRound ? bestRound.number : null, bestPosition } });
  } catch (e) { return next(e); }
}

module.exports = { me, update, password, stats };
