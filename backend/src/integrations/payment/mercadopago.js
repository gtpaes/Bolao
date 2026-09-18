const config = require("../../config/env");
const logger = require("../../config/logger");

// Cria cobrança Pix via Mercado Pago (Checkout Pro / Payment API).
// Retorna { gatewayPaymentId, qrText, qrBase64, expiresAt, expiresInSeconds }.
async function createPixCharge({ paymentId, amountCents, description, idempotencyKey, payerEmail }) {
  if (!config.mp.accessToken) {
    const err = new Error("Pagamentos ainda não estão configurados no servidor.");
    err.status = 503;
    err.code = "PAYMENT_DISABLED";
    throw err;
  }
  const { MercadoPagoConfig, Payment: MpPayment } = require("mercadopago");
  const client = new MercadoPagoConfig({ accessToken: config.mp.accessToken });
  const payment = new MpPayment(client);
  const email = String(payerEmail || "comprador@bolao.local").trim().toLowerCase();
  const body = {
    transaction_amount: Number((amountCents / 100).toFixed(2)),
    description: String(description || "Bolão — tickets").slice(0, 120),
    payment_method_id: "pix",
    payer: { email },
    external_reference: String(paymentId),
    notification_url: undefined,
  };
  try {
    const res = await payment.create({ body, requestOptions: { idempotencyKey } });
    const tx = res?.point_of_interaction?.transaction_data || {};
    return {
      gatewayPaymentId: String(res.id),
      qrText: tx.qr_code || null,
      qrBase64: tx.qr_code_base64 || null,
      expiresAt: tx.expiration_time ? new Date(tx.expiration_time) : new Date(Date.now() + 30 * 60 * 1000),
      expiresInSeconds: 1800,
    };
  } catch (e) {
    logger.error({ err: String(e && e.message) }, "falha ao criar cobrança Pix");
    const err = new Error("Não foi possível gerar a cobrança. Tente novamente.");
    err.status = 502;
    err.code = "PAYMENT_ERROR";
    throw err;
  }
}

async function fetchGatewayPayment(gatewayPaymentId) {
  if (!config.mp.accessToken || !gatewayPaymentId) return null;
  try {
    const { MercadoPagoConfig, Payment: MpPayment } = require("mercadopago");
    const client = new MercadoPagoConfig({ accessToken: config.mp.accessToken });
    const payment = new MpPayment(client);
    const res = await payment.get({ id: String(gatewayPaymentId) });
    const map = { approved: "approved", pending: "pending", in_process: "pending", rejected: "refused", cancelled: "refused", expired: "expired" };
    return { status: map[res.status] || "pending", raw: res.status };
  } catch (e) {
    logger.warn({ err: String(e && e.message) }, "falha ao consultar pagamento no gateway");
    return null;
  }
}

module.exports = { createPixCharge, fetchGatewayPayment };
