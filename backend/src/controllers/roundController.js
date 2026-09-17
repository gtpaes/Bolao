const roundService = require("../services/roundService");

async function current(req, res, next) {
  try { return res.json({ round: await roundService.getCurrentRound(), meta: { source: "api-futebol" } }); }
  catch (e) { return next(e); }
}
async function list(req, res, next) {
  try { return res.json({ rounds: await roundService.listRounds() }); }
  catch (e) { return next(e); }
}
async function get(req, res, next) {
  try { return res.json({ round: await roundService.getRound(req.params.id) }); }
  catch (e) { return next(e); }
}
async function matches(req, res, next) {
  try { return res.json({ matches: await roundService.listMatches(req.query.round) }); }
  catch (e) { return next(e); }
}
async function adminMatches(req, res, next) {
  try {
    const matches = await roundService.listAdminMatches(req.params.id);
    return res.json({ matches: matches || [] });
  } catch (e) { return next(e); }
}
async function live(req, res, next) {
  try { return res.json({ matches: await roundService.listLive() }); }
  catch (e) { return next(e); }
}

module.exports = { current, list, get, matches, adminMatches, live };
