const bcrypt = require("bcryptjs");
const User = require("../models/User");
const PasswordReset = require("../models/PasswordReset");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("./mailer");
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

async function updateProfile(userId, { username }) {
  const cleanName = String(username || "").trim();
  if (cleanName.length < 3 || cleanName.length > 30) throw badRequest("Nome de usuário inválido.");
  const conflictUser = await User.findOne({ username: cleanName, _id: { $ne: userId } }).lean();
  if (conflictUser) throw conflict("Este nome de usuário já está em uso.", "USERNAME_EXISTS");
  const user = await User.findByIdAndUpdate(userId, { $set: { username: cleanName } }, { new: true });
  if (!user) throw unauthorized("Usuário não encontrado.");
  return user.toSafeJSON();
}

async function changePassword(userId, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword || String(newPassword).length < 8) throw badRequest("A nova senha deve ter ao menos 8 caracteres.");
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !(await bcrypt.compare(String(currentPassword), user.passwordHash))) throw unauthorized("A senha atual está incorreta.");
  user.passwordHash = await bcrypt.hash(String(newPassword), 12);
  await user.save();
}

async function requestPasswordReset(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const user = await User.findOne({ email: cleanEmail });
  if (!user) return;
  const token = crypto.randomBytes(32).toString("hex");
  await PasswordReset.deleteMany({ userId: user._id });
  await PasswordReset.create({ userId: user._id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
  await sendPasswordResetEmail({ to: user.email, username: user.username, token });
}

async function resetPassword(token, newPassword) {
  if (!token || !newPassword || String(newPassword).length < 8) throw badRequest("Token ou senha inválidos.");
  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const reset = await PasswordReset.findOne({ tokenHash, usedAt: null, expiresAt: { $gt: new Date() } });
  if (!reset) throw badRequest("O link de recuperação é inválido ou expirou.");
  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  await User.updateOne({ _id: reset.userId }, { $set: { passwordHash } });
  reset.usedAt = new Date();
  await reset.save();
}

module.exports = { register, login, updateProfile, changePassword, requestPasswordReset, resetPassword };
