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

module.exports = { register, login };
