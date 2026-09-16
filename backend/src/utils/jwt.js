const jwt = require("jsonwebtoken");
const config = require("../config/env");

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiration }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { signToken, verifyToken };
