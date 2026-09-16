const crypto = require("crypto");
const config = require("../config/env");
const logger = require("../config/logger");
const { confirmPaymentByGateway } = require("../services/paymentService");
const { badRequest, forbidden } = require("../utils/errors");

// Valida a assinatura do webhook do Mercado Pago (x-signature: ts=...,v1=...)
function verifySignature(req) {
  if (!config.mp.webhookSecret) return true;
  const sig = req.headers["x-signature"] || "";
  const parts = Object.fromEntries(
    String(sig).split(",").map((p) => { const [k, v] = p.split("="); return [k && k.trim(), v && v.trim()]; }).filter(([k, v]) => k && v)
  );
  if (!parts.ts || !parts.v1) return false;
  const id = (req.query && (req.query["data.id"] || req.query.id)) || (req.body && req.body.data && req.body.data.id) || "";
  const manifest = `id:${id};request-id:${req.headers["x-request-id"] || ""};ts:${parts.ts};`;
  const hmac = crypto.createHmac("sha256", config.mp.webhookSecret).update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(String(parts.v1)));
  } catch (e) {
    return false;
  }
}

function mapMpStatus(s) {
  const v = String(s || "").toLowerCase();
  if (v === "approved") return "approved";
  if (v === "pending" || v === "in_process" || v === "in_mediation") return "pending";
  if (v === "expired") return "expired";
  return "refused";
}

// POST /api/webhooks/mercadopago — único caminho que aprova pagamento.
async function mercadopago(req, res, next) {
  try {
    if (!verifySignature(req)) throw forbidden("Assinatura inválida.");
    const body = req.body || {};
    const type = body.type || body.topic;
    if (type !== "payment") return res.json({ ok: true, ignored: true });
    const gatewayPaymentId = String((body.data && body.data.id) || req.query["data.id"] || "");
    if (!gatewayPaymentId) throw badRequest("data.id ausente.");
    const eventId = String(body.id || `${gatewayPaymentId}:${Date.now()}`);

    // Busca o status real no gateway (não confia no corpo do webhook).
    const { fetchGatewayPayment } = require("../integrations/payment/mercadopago");
    const remote = await fetchGatewayPayment(gatewayPaymentId);
    const status = mapMpStatus(remote && remote.raw);
    const payment = await confirmPaymentByGateway({ gatewayPaymentId, status, webhookEventId: eventId });
    logger.info({ payment: String(payment._id), status }, "webhook processado");
    return res.json({ ok: true });
  } catch (e) { return next(e); }
}

module.exports = { mercadopago };
