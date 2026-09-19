const Round = require("../models/Round");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const Payment = require("../models/Payment");
const settingsService = require("../services/settingsService");
const { syncRound } = require("../integrations/football/sync");
const { processRoundScoring } = require("../services/scoringService");
const { closeRound: closeRoundService, reopenRound: reopenRoundService, setAutomatic, closesAt } = require("../services/roundLifecycle");
const { badRequest, notFound } = require("../utils/errors");

async function overview(req, res, next) {
  try {
    const [users, rounds, tickets, revenue] = await Promise.all([
      User.countDocuments(),
      Round.countDocuments(),
      Ticket.countDocuments({ status: { $in: ["released", "closed", "scored"] } }),
      Payment.aggregate([{ $match: { status: "approved" } }, { $group: { _id: null, total: { $sum: "$amountCents" } } }]),
    ]);
    const current = await Round.findOne({ status: { $in: ["open", "closed", "finished"] } }).sort({ number: -1 }).lean();
    return res.json({
      users, rounds, tickets,
      revenueCents: (revenue[0] && revenue[0].total) || 0,
      currentRound: current ? {
        id: String(current._id),
        number: current.number,
        status: current.status,
        deadline: current.deadline,
        manualOverride: Boolean(current.manualOverride),
        closesAt: (() => {
          const ms = closesAt(current);
          return ms == null ? null : new Date(ms);
        })(),
      } : null,
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

// Fechar/reabrir na mão marca a rodada como "controle manual": a regra automática
// (1º jogo − 2h) deixa de agir sobre ela até o admin devolver o controle. Os tickets
// são movidos junto (released <-> closed) pelo service, na mesma operação.
async function closeRound(req, res, next) {
  try {
    const result = await closeRoundService(req.params.id, { manual: true });
    if (!result.round) throw notFound("Rodada não encontrada.");
    return res.json({
      ok: true,
      roundId: String(result.round._id),
      status: result.round.status,
      manualOverride: Boolean(result.round.manualOverride),
      ticketsUpdated: result.ticketsUpdated,
    });
  } catch (e) { return next(e); }
}

async function reopenRound(req, res, next) {
  try {
    const result = await reopenRoundService(req.params.id, { manual: true });
    if (!result.round) throw notFound("Rodada não encontrada.");
    return res.json({
      ok: true,
      roundId: String(result.round._id),
      status: result.round.status,
      manualOverride: Boolean(result.round.manualOverride),
      ticketsUpdated: result.ticketsUpdated,
    });
  } catch (e) { return next(e); }
}

// Devolve a rodada à regra automática (limpa o controle manual). O próximo sync ou
// o cron volta a fechá-la quando a janela (1º jogo − 2h) vencer.
async function setRoundAutomatic(req, res, next) {
  try {
    const result = await setAutomatic(req.params.id);
    if (!result.round) throw notFound("Rodada não encontrada.");
    return res.json({ ok: true, roundId: String(result.round._id), status: result.round.status, manualOverride: false });
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

async function setRoundMatches(req, res, next) {
  try {
    const { matchIds } = req.body || {};
    if (!Array.isArray(matchIds)) throw badRequest("Informe a lista de jogos selecionados.");
    const round = await Round.findById(req.params.id);
    if (!round) throw notFound("Rodada não encontrada.");
    const selected = new Set(matchIds.map((id) => Number(id)).filter(Number.isFinite));
    let selectedCount = 0;
    for (const match of round.matches) {
      match.enabledForTickets = selected.has(Number(match.externalId));
      if (match.enabledForTickets) selectedCount += 1;
    }
    await round.save();
    return res.json({ ok: true, roundId: String(round._id), selectedCount });
  } catch (e) { return next(e); }
}

async function addMatch(req, res, next) {
  try {
    const { home, away, startsAt } = req.body || {};
    if (!String(home || "").trim() || !String(away || "").trim()) throw badRequest("Informe os dois times.");
    const round = await Round.findById(req.params.id);
    if (!round) throw notFound("Rodada não encontrada.");
    const date = startsAt ? new Date(startsAt) : null;
    if (startsAt && Number.isNaN(date.getTime())) throw badRequest("Data do jogo inválida.");
    const externalId = -Date.now();
    round.matches.push({ externalId, home: String(home).trim(), away: String(away).trim(), startsAt: date, enabledForTickets: true, isManual: true, status: "scheduled" });
    await round.save();
    return res.status(201).json({ ok: true, match: { id: String(externalId), externalId, home: String(home).trim(), away: String(away).trim(), date, enabled_for_tickets: true } });
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
    const tickets = await Ticket.find({}).sort({ createdAt: -1 }).limit(200).populate("userId", "username").populate("roundId", "number").lean();
    return res.json({
      tickets: tickets.map((t) => ({
        id: String(t._id),
        number: t.number,
        user: t.userId && t.userId.username ? t.userId.username : "—",
        round: t.roundId && t.roundId.number,
        status: t.status,
        points: t.points || 0,
        createdAt: t.createdAt,
      })),
    });
  } catch (e) { return next(e); }
}

async function setUserRole(req, res, next) {
  try {
    const { role } = req.body || {};
    if (!["admin", "user"].includes(role)) throw badRequest("Papel inválido. Use \"admin\" ou \"user\".");
    const user = await User.findById(req.params.id);
    if (!user) throw notFound("Usuário não encontrado.");
    if (user.role === "dev") throw badRequest("Não é possível alterar o papel de uma conta dev.");
    if (String(user._id) === String(req.user.id)) throw badRequest("Não é possível alterar o próprio papel por aqui.");
    user.role = role;
    await user.save();
    return res.json({ ok: true, user: { id: String(user._id), username: user.username, email: user.email, role: user.role } });
  } catch (e) { return next(e); }
}

async function getSettings(req, res, next) {
  try { return res.json({ settings: await settingsService.getSettings() }); }
  catch (e) { return next(e); }
}

// Salva as regras globais. Elas valem para todas as rodadas automaticamente,
// então não existe (nem é preciso) salvar regra por rodada.
async function updateSettings(req, res, next) {
  try { return res.json({ ok: true, settings: await settingsService.updateSettings(req.body || {}) }); }
  catch (e) { return next(e); }
}

module.exports = { overview, setDeadline, closeRound, reopenRound, setRoundAutomatic, syncNow, setRoundMatches, addMatch, listUsers, listTickets, setUserRole, getSettings, updateSettings };
