const Round = require("../models/Round");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { syncRound } = require("../integrations/football/sync");
const { processRoundScoring } = require("../services/scoringService");
const { badRequest, notFound } = require("../utils/errors");

async function overview(req, res, next) {
  try {
    const [users, rounds, tickets, revenue] = await Promise.all([
      User.countDocuments(),
      Round.countDocuments(),
      Ticket.countDocuments(),
      Payment.aggregate([{ $match: { status: "approved" } }, { $group: { _id: null, total: { $sum: "$amountCents" } } }]),
    ]);
    const current = await Round.findOne({ status: { $in: ["open", "closed"] } }).sort({ number: -1 }).lean();
    return res.json({
      users, rounds, tickets,
      revenueCents: (revenue[0] && revenue[0].total) || 0,
      currentRound: current ? { id: String(current._id), number: current.number, status: current.status, deadline: current.deadline } : null,
    });
  } catch (e) { return next(e); }
}

async function setDeadline(req, res, next) {
  try {
    const { deadline } = req.body || {};
    const d = new Date(deadline);
    if (!deadline || Number.isNaN(d.getTime())) throw badRequest("Deadline inválido.");
    const round = await Round.findById(req.params.id);
    if (!round) throw notFound("Rodada não encontrada.");
    round.deadline = d;
    await round.save();
    return res.json({ ok: true, id: String(round._id), deadline: round.deadline });
  } catch (e) { return next(e); }
}

async function closeRound(req, res, next) {
  try {
    const round = await Round.findById(req.params.id);
    if (!round) throw notFound("Rodada não encontrada.");
    round.status = "closed";
    await round.save();
    await Ticket.updateMany({ roundId: round._id, status: "released" }, { $set: { status: "closed" } });
    return res.json({ ok: true });
  } catch (e) { return next(e); }
}

async function reopenRound(req, res, next) {
  try {
    const round = await Round.findById(req.params.id);
    if (!round) throw notFound("Rodada não encontrada.");
    round.status = "open";
    await round.save();
    return res.json({ ok: true });
  } catch (e) { return next(e); }
}

async function syncNow(req, res, next) {
  try {
    const force = req.body && req.body.round != null ? Number(req.body.round) : undefined;
    const result = await syncRound(force);
    if (result && result.round != null) {
      const round = await Round.findOne({ number: result.round });
      if (round) await processRoundScoring(round._id);
    }
    return res.json({ ok: true, ...result });
  } catch (e) { return next(e); }
}

async function listUsers(req, res, next) {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ users: users.map((u) => ({ id: String(u._id), username: u.username, email: u.email, role: u.role, createdAt: u.createdAt })) });
  } catch (e) { return next(e); }
}

async function listTickets(req, res, next) {
  try {
    const tickets = await Ticket.find({}).sort({ createdAt: -1 }).limit(200).populate("userId", "username").lean();
    return res.json({
      tickets: tickets.map((t) => ({
        id: String(t._id),
        number: t.number,
        user: t.userId && t.userId.username ? t.userId.username : "—",
        status: t.status,
        points: t.points || 0,
        createdAt: t.createdAt,
      })),
    });
  } catch (e) { return next(e); }
}

module.exports = { overview, setDeadline, closeRound, reopenRound, syncNow, listUsers, listTickets };
