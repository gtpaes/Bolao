const ticketService = require("../services/ticketService");
const { badRequest } = require("../utils/errors");

async function list(req, res, next) {
  try { return res.json({ tickets: await ticketService.listMyTickets(req.user.id) }); }
  catch (e) { return next(e); }
}

async function publicPicks(req, res, next) {
  try { return res.json(await ticketService.listPublicPicks(req.query.round)); }
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
    const data = await ticketService.buyTickets(req.user.id, quantity);
    return res.status(201).json({ ok: true, ...data });
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
