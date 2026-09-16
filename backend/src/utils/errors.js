class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function badRequest(message = "Requisição inválida.") {
  return new AppError(400, "VALIDATION_ERROR", message);
}
function unauthorized(message = "Não autenticado.") {
  return new AppError(401, "UNAUTHORIZED", message);
}
function forbidden(message = "Acesso negado.", code = "FORBIDDEN") {
  return new AppError(403, code, message);
}
function notFound(message = "Não encontrado.") {
  return new AppError(404, "NOT_FOUND", message);
}
function conflict(message = "Conflito.", code = "CONFLICT") {
  return new AppError(409, code, message);
}
function paymentRequired(message = "Pagamento necessário.") {
  return new AppError(402, "PAYMENT_REQUIRED", message);
}

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, paymentRequired };
