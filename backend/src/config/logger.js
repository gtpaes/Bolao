const pino = require("pino");

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: ["password", "token", "authorization", "access_token", "*.password", "*.token"],
    censor: "***",
  },
});

module.exports = logger;
