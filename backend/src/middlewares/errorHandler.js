const { AppError } = require("../utils/errors");
const logger = require("../config/logger");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && (err.status || err instanceof AppError)) {
    return res.status(err.status || 400).json({
      timestamp: new Date().toISOString(),
      status: err.status || 400,
      error: err.code || "APP_ERROR",
      message: err.message || "Erro.",
      path: req.originalUrl,
    });
  }
  if (err && err.name === "ZodError") {
    const message = (err.issues && err.issues[0] && err.issues[0].message) || "Dados inválidos.";
    return res.status(400).json({
      timestamp: new Date().toISOString(),
      status: 400,
      error: "VALIDATION_ERROR",
      message,
      path: req.originalUrl,
    });
  }
  logger.error({ err: String((err && err.message) || err), path: req.originalUrl }, "unhandled error");
  return res.status(500).json({
    timestamp: new Date().toISOString(),
    status: 500,
    error: "INTERNAL_ERROR",
    message: "Erro interno. Tente novamente.",
    path: req.originalUrl,
  });
}

module.exports = { errorHandler };
