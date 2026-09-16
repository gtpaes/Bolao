const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const { conflict, unauthorized, badRequest } = require("../utils/errors");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register({ username, email, password, role }) {
  const cleanName = String(username || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (cleanName.length < 3 || cleanName.length > 30) throw badRequest("Nome de usuário inválido.");
  if (!EMAIL_RE.test(cleanEmail)) throw badRequest("E-mail inválido.");
  if (!password || String(password).length < 8) throw badRequest("A senha deve ter ao menos 8 caracteres.");

  const exists = await User.findOne({ $or: [{ email: cleanEmail }, { username: cleanName }] }).lean();
  if (exists) throw conflict("Já existe uma conta com este e-mail ou usuário.", "ACCOUNT_EXISTS");

  const passwordHash = await bcrypt.hash(String(password), 12);
  const user = await User.create({ username: cleanName, email: cleanEmail, passwordHash, role: "user" });
  void role;
  const token = signToken(user);
  return { token, user: user.toSafeJSON() };
}

async function login({ email, password }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) throw badRequest("E-mail inválido.");
  if (!password) throw badRequest("Informe a senha.");
  const user = await User.findOne({ email: cleanEmail }).select("+passwordHash");
  if (!user) throw unauthorized("E-mail ou senha inválidos.");
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) throw unauthorized("E-mail ou senha inválidos.");
  const token = signToken(user);
  const safe = await User.findById(user._id).lean();
  return {
    token,
    user: { id: String(safe._id), username: safe.username, email: safe.email, role: safe.role, createdAt: safe.createdAt },
  };
}

module.exports = { register, login };
