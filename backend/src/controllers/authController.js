const authService = require("../services/authService");
const { badRequest } = require("../utils/errors");

async function register(req, res, next) {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) throw badRequest("Informe usuário, e-mail e senha.");
    const data = await authService.register({ username, email, password });
    return res.status(201).json({ ok: true, data });
  } catch (e) { return next(e); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw badRequest("Informe e-mail e senha.");
    const data = await authService.login({ email, password });
    return res.status(200).json({ ok: true, data });
  } catch (e) { return next(e); }
}

async function requestReset(req, res, next) {
  try { await authService.requestPasswordReset(req.body && req.body.email); return res.json({ ok: true }); }
  catch (e) { return next(e); }
}

async function resetPassword(req, res, next) {
  try { await authService.resetPassword(req.body && req.body.token, req.body && req.body.password); return res.json({ ok: true }); }
  catch (e) { return next(e); }
}

module.exports = { register, login, requestReset, resetPassword };
