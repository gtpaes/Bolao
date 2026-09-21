const Ticket = require("../models/Ticket");
const TicketCounter = require("../models/TicketCounter");
const Settings = require("../models/Settings");
const Round = require("../models/Round");
const Payment = require("../models/Payment");
const logger = require("../config/logger");
const { createPixCharge, fetchGatewayPayment, cancelGatewayPayment } = require("../integrations/payment/mercadopago");
const { autoCloseIfDue, isRoundOpenForPicks } = require("./roundLifecycle");
const { newIdempotencyKey } = require("../utils/idempotency");
const { badRequest, forbidden, notFound } = require("../utils/errors");

const UNIT_PRICE_CENTS = 1000;

// A venda fecha no MESMO instante dos palpites (1º jogo − 2h): o helper decide pelo
// relógio, sem depender de o timer já ter gravado status "closed". Quando vence,
// aproveitamos para alinhar o estado (fecha a rodada e marca os tickets) — mas só
// se o admin não tiver desligado o fechamento automático em Configurações.
// A recusa vale sempre; o que o "autoClose=false" desliga é o fechamento sozinho.
async function openRoundOrThrow({ autoClose = true } = {}) {
  const round = await Round.findOne({ status: "open" }).sort({ number: -1 });
  if (!round) throw badRequest("Nenhuma rodada aberta no momento.");
  if (!isRoundOpenForPicks(round)) {
    if (autoClose) await autoCloseIfDue(round).catch(() => {});
    throw forbidden("A venda de tickets desta rodada foi encerrada.", "ROUND_CLOSED");
  }
  return round;
}

// Cria a cobrança Pix da compra atual (qty vindo do frontend; total recalculado aqui).
async function createPayment(userId, quantity) {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 100) throw badRequest("Quantidade inválida.");

  try {
    // Configurações primeiro: o autoClose decide se uma venda tardia também fecha a
    // rodada, ou se o fechamento fica a cargo do admin.
    const settings = await Settings.findOne({ key: "default" }).lean();
    const round = await openRoundOrThrow({ autoClose: !settings || settings.autoClose !== false });
    const unitPriceCents = settings && Number(settings.priceCents) > 0 ? Number(settings.priceCents) : UNIT_PRICE_CENTS;
    const totalCents = qty * unitPriceCents;

    logger.info({ userId, quantity: qty, roundId: String(round._id), totalCents }, "iniciando criacao de pagamento");

    const payment = await Payment.create({
      userId,
      roundId: round._id,
      quantity: qty,
      ticketIds: [],
      amountCents: totalCents,
      status: "pending",
      idempotencyKey: newIdempotencyKey("pay"),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    const user = await require("../models/User").findById(userId).lean();
    const payerEmail = user && user.email ? user.email : "comprador@bolao.local";
    const charge = await createPixCharge({
      paymentId: String(payment._id),
      amountCents: totalCents,
      description: `Bolão — ${qty} ticket(s)`,
      idempotencyKey: payment.idempotencyKey,
      payerEmail,
    });
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { gatewayPaymentId: charge.gatewayPaymentId, qrText: charge.qrText || null, qrBase64: charge.qrBase64 || null, expiresAt: charge.expiresAt || payment.expiresAt } }
    );

    logger.info({ paymentId: String(payment._id), gatewayPaymentId: charge.gatewayPaymentId }, "pagamento Pix criado com sucesso");

    return {
      id: String(payment._id),
      qrcode: charge.qrBase64 || null,
      qrcode_text: charge.qrText || null,
      expires_in: charge.expiresInSeconds || 1800,
      amount: totalCents / 100,
    };
  } catch (e) {
    logger.error({ err: { message: e && e.message, stack: e && e.stack }, userId, quantity }, "falha ao criar pagamento");
    throw e;
  }
}

async function getPaymentStatus(userId, paymentId) {
  const p = await Payment.findById(paymentId).lean();
  if (!p || String(p.userId) !== String(userId)) throw notFound("Pagamento não encontrado.");
  await refreshFromGateway(p);
  const current = await Payment.findById(paymentId).lean();
  // Exige netAmountCents: o frontend mostra quanto efetivamente caiu no MP
  // (brute amount menos a fee do Pix). Null para aprovados antes da migration.
  return { status: current.status, message: statusMessage(current.status), amountCents: current.amountCents, netAmountCents: current.netAmountCents };
}

function statusMessage(status) {
  const map = { pending: "Aguardando pagamento", approved: "Pagamento aprovado", expired: "Pagamento expirado", cancelled: "Compra cancelada", refused: "Pagamento recusado" };
  return map[status] || status;
}

async function refreshFromGateway(payment) {
  if (!payment || payment.status !== "pending" || !payment.gatewayPaymentId) return payment;
  const remote = await fetchGatewayPayment(payment.gatewayPaymentId);
  if (!remote || !remote.status) return payment;
  if (remote.status === payment.status && !(remote.status === "approved" && !(payment.ticketIds || []).length)) return payment;
  if (remote.status === "approved") return releasePaymentTickets(payment._id, "approved", remote && remote.netAmountCents);
  if (payment.status !== "approved") await Payment.updateOne({ _id: payment._id }, { $set: { status: remote.status } });
  return Payment.findById(payment._id).lean();
}

async function releasePaymentTickets(paymentId, status, netAmountCents) {
  const session = await Payment.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) throw notFound("Pagamento não encontrado.");
      if (payment.status === "cancelled") {
        result = payment.toObject();
        return;
      }
      if (payment.status === "approved" && payment.ticketIds && payment.ticketIds.length) {
        result = payment.toObject();
        return;
      }
      if (status !== "approved") {
        if (payment.status !== "approved") payment.status = status;
        await payment.save({ session });
        result = payment.toObject();
        return;
      }
      const counter = await TicketCounter.findOneAndUpdate(
        { userId: payment.userId, roundId: payment.roundId },
        { $setOnInsert: { nextNumber: 0 }, $inc: { nextNumber: payment.quantity } },
        { upsert: true, new: true, session }
      );
      // Pagamento aprovado DEPOIS do fechamento (ex.: Pix pago no apagar das luzes)
      // não pode liberar um ticket que já nasce bloqueado — ele entra como "closed".
      // Antes disso, a rodada ficava fechada com tickets marcados como liberados.
      const round = await Round.findById(payment.roundId).session(session).lean();
      const ticketStatus = isRoundOpenForPicks(round) ? "released" : "closed";
      const startNumber = counter.nextNumber - payment.quantity + 1;
      const docs = Array.from({ length: payment.quantity }, (_, index) => ({
        userId: payment.userId,
        roundId: payment.roundId,
        number: startNumber + index,
        unitPriceCents: Math.floor(payment.amountCents / payment.quantity),
        status: ticketStatus,
        picks: [],
        points: 0,
        paymentId: payment._id,
      }));
      const created = await Ticket.insertMany(docs, { ordered: true, session });
      payment.ticketIds = created.map((ticket) => ticket._id);
      payment.status = "approved";
      // grava o líquido efetivamente creditado no MP (com a fee do Pix já descontada).
      if (typeof netAmountCents === "number") payment.netAmountCents = netAmountCents;
      await payment.save({ session });
      result = payment.toObject();
    });
  } finally {
    await session.endSession();
  }
  return result;
}

// Chamado SOMENTE pelo webhook (assinatura validada na rota). Idempotente.
async function confirmPaymentByGateway({ gatewayPaymentId, status, webhookEventId, netAmountCents }) {
  if (!gatewayPaymentId) throw badRequest("gatewayPaymentId ausente.");
  if (webhookEventId) {
    const dup = await Payment.findOne({ webhookEventId }).lean();
    if (dup) return dup;
  }
  const payment = await Payment.findOne({ gatewayPaymentId });
  if (!payment) throw notFound("Pagamento não encontrado.");
  if (webhookEventId) payment.webhookEventId = webhookEventId;
  if (payment.status === "approved" && payment.ticketIds && payment.ticketIds.length) return payment.toObject();
  return releasePaymentTickets(payment._id, status, netAmountCents);
}

async function cancelPayment(userId, paymentId) {
  const payment = await Payment.findById(paymentId);
  if (!payment || String(payment.userId) !== String(userId)) throw notFound("Pagamento não encontrado.");
  if (payment.status === "approved") throw forbidden("Pagamento já aprovado não pode ser cancelado.");
  if (payment.status === "cancelled") return payment.toObject();
  if (payment.gatewayPaymentId) {
    try {
      await cancelGatewayPayment(payment.gatewayPaymentId);
    } catch (e) {
      logger.warn({ err: String(e && e.message) }, "falha ao cancelar no gateway");
    }
  }
  payment.status = "cancelled";
  await payment.save();
  return payment.toObject();
}

module.exports = { createPayment, getPaymentStatus, confirmPaymentByGateway, cancelPayment, UNIT_PRICE_CENTS };
