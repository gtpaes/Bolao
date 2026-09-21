const paymentService = require("../services/paymentService");
const { badRequest } = require("../utils/errors");

async function create(req, res, next) {
  try {
    const { quantity } = req.body || {};
    if (quantity == null) throw badRequest("Informe a quantidade.");
    const data = await paymentService.createPayment(req.user.id, quantity);
    return res.status(201).json(data);
  } catch (e) { return next(e); }
}
async function status(req, res, next) {
  try {
    const data = await paymentService.getPaymentStatus(req.user.id, req.params.id);
    return res.json(data);
  } catch (e) { return next(e); }
}

async function cancel(req, res, next) {
  try {
    const data = await paymentService.cancelPayment(req.user.id, req.params.id);
    return res.json(data);
  } catch (e) { return next(e); }
}

module.exports = { create, status, cancel };
