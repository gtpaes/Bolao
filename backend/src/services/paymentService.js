const Ticket = require("../models/Ticket");
const Round = require("../models/Round");
const Payment = require("../models/Payment");
const { createPixCharge, fetchGatewayPayment } = require("../integrations/payment/mercadopago");
const { newIdempotencyKey } = require("../utils/idempotency");
const { badRequest, forbidden, notFound } = require("../utils/errors");

const UNIT_PRICE_CENTS = 1000;

async function openRoundOrThrow() {
  const round = await Round.findOne({ status: "open" }).sort({ number: -1 });
  if (!round) throw badRequest("Nenhuma rodada aberta no momento.");
  return round;
}

// Cria a cobrança Pix da compra atual (qty vindo do frontend; total recalculado aqui).
async function createPayment(userId, quantity) {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 100) throw badRequest("Quantidade inválida.");
  const round = await openRoundOrThrow();
  const totalCents = qty * UNIT_PRICE_CENTS;

  const last = await Ticket.find({ userId, roundId: round._id }).sort({ number: -1 }).limit(1).lean();
  const startNumber = last.length ? last[0].number + 1 : 1;
  const docs = [];
  for (let i = 0; i < qty; i += 1) {
    docs.push({ userId, roundId: round._id, number: startNumber + i, unitPriceCents: UNIT_PRICE_CENTS, status: "waiting_payment", picks: [], points: 0 });
  }
  const created = await Ticket.insertMany(docs, { ordered: true });
  const payment = await Payment.create({
    userId,
    ticketIds: created.map((t) => t._id),
    amountCents: totalCents,
    status: "pending",
    idempotencyKey: newIdempotencyKey("pay"),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  await Ticket.updateMany({ _id: { $in: created.map((t) => t._id) } }, { $set: { paymentId: payment._id } });

  const charge = await createPixCharge({ paymentId: String(payment._id), amountCents: totalCents, description: `Bolão — ${qty} ticket(s)`, idempotencyKey: payment.idempotencyKey });
  await Payment.updateOne(
    { _id: payment._id },
    { $set: { gatewayPaymentId: charge.gatewayPaymentId, qrText: charge.qrText || null, qrBase64: charge.qrBase64 || null, expiresAt: charge.expiresAt || payment.expiresAt } }
  );

  return {
    id: String(payment._id),
    qrcode: charge.qrBase64 || null,
    qrcode_text: charge.qrText || null,
    expires_in: charge.expiresInSeconds || 1800,
    amount: totalCents / 100,
  };
}

async function getPaymentStatus(userId, paymentId) {
  const p = await Payment.findById(paymentId).lean();
  if (!p || String(p.userId) !== String(userId)) throw notFound("Pagamento não encontrado.");
  refreshFromGateway(p).catch(() => {});
  const current = await Payment.findById(paymentId).lean();
  return { status: current.status, message: statusMessage(current.status) };
}

function statusMessage(status) {
  const map = { pending: "Aguardando pagamento", approved: "Pagamento aprovado", expired: "Pagamento expirado", refused: "Pagamento recusado" };
  return map[status] || status;
}

async function refreshFromGateway(payment) {
  if (!payment || payment.status !== "pending" || !payment.gatewayPaymentId) return payment;
  const remote = await fetchGatewayPayment(payment.gatewayPaymentId);
  if (!remote || !remote.status) return payment;
  if (remote.status === payment.status) return payment;
  await Payment.updateOne({ _id: payment._id }, { $set: { status: remote.status } });
  if (remote.status === "approved") {
    await Ticket.updateMany({ _id: { $in: payment.ticketIds || [] } }, { $set: { status: "released" } });
  }
  return Payment.findById(payment._id).lean();
}

// Chamado SOMENTE pelo webhook (assinatura validada na rota). Idempotente.
async function confirmPaymentByGateway({ gatewayPaymentId, status, webhookEventId }) {
  if (!gatewayPaymentId) throw badRequest("gatewayPaymentId ausente.");
  if (webhookEventId) {
    const dup = await Payment.findOne({ webhookEventId }).lean();
    if (dup) return dup;
  }
  const payment = await Payment.findOne({ gatewayPaymentId });
  if (!payment) throw notFound("Pagamento não encontrado.");
  if (webhookEventId) payment.webhookEventId = webhookEventId;
  if (payment.status === "approved" && status === "approved") {
    await payment.save();
    return payment.toObject();
  }
  payment.status = status;
  await payment.save();
  if (status === "approved") {
    await Ticket.updateMany({ _id: { $in: payment.ticketIds || [] } }, { $set: { status: "released" } });
  }
  return payment.toObject();
}

module.exports = { createPayment, getPaymentStatus, confirmPaymentByGateway, UNIT_PRICE_CENTS };
