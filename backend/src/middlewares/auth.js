const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const { unauthorized, forbidden } = require("../utils/errors");

async function authJwt(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) throw unauthorized();
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).lean();
    if (!user) throw unauthorized("Sessão inválida.");
    req.user = { id: String(user._id), role: user.role, username: user.username, email: user.email };
    return next();
  } catch (e) {
    return next(e && e.status ? e : unauthorized("Sessão inválida ou expirada."));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    return next();
  };
}

module.exports = { authJwt, requireRole };
