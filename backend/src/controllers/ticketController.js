const ticketService = require("../services/ticketService");
const paymentService = require("../services/paymentService");
const { badRequest } = require("../utils/errors");

// GET /api/tickets           -> só a rodada corrente (cada ticket vale por rodada)
// GET /api/tickets?round=all -> todas as rodadas (auditoria/compatibilidade)
// GET /api/tickets?round=<id> -> uma rodada específica
async function list(req, res, next) {
  try { return res.json(await ticketService.listMyTickets(req.user.id, { roundId: req.query.round })); }
  catch (e) { return next(e); }
}

async function publicPicks(req, res, next) {
  try { return res.json(await ticketService.listPublicPicks(req.query.round, req.query.ticket)); }
  catch (e) { return next(e); }
}
async function get(req, res, next) {
  try { return res.json({ ticket: await ticketService.getMyTicket(req.user.id, req.params.id) }); }
  catch (e) { return next(e); }
}
async function buy(req, res, next) {
  try {
    const { quantity } = req.body || {};
    if (quantity == null) throw badRequest("Informe a quantidade.");
    const data = await paymentService.createPayment(req.user.id, quantity);
    return res.status(201).json({ ok: true, payment: data });
  } catch (e) { return next(e); }
}
async function picks(req, res, next) {
  try {
    const { picks } = req.body || {};
    const data = await ticketService.savePicks(req.user.id, req.params.id, picks);
    return res.json({ ok: true, ticket: data });
  } catch (e) { return next(e); }
}

module.exports = { list, get, buy, picks, publicPicks };
