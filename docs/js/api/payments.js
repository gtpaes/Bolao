/* js/api/payments.js — Pagamentos Pix.
   NÃO gera QR Code nem simula aprovação aqui. Só prepara a UI. */
import { request, API, operationPending } from "./client.js";

/** Cria cobrança Pix. Retorna dados { id, qrcode, qrcode_text, expires_in, amount } */
export async function createPayment({ quantity }) {
  if (!API.mock) return request("/payments", { method: "POST", body: { quantity } });
  return operationPending("POST /api/payments (Pix)");
}

export async function getPayment(id) {
  if (!API.mock) return request(`/payments/${id}/status`);
  return operationPending("GET /api/payments/:id/status");
}

/** Consulta o status de uma cobrança. */
export async function paymentStatus(id) {
  if (!API.mock) return request(`/payments/${id}/status`);
  // Nenhuma cobrança ativa — status desconhecido.
  return { status: "unknown", message: "sem dados" };
}

/** Cancela uma cobranca Pix pendente. */
export async function cancelPayment(id) {
  if (!API.mock) return request(`/payments/${id}/cancel`, { method: "POST" });
  return operationPending("POST /api/payments/:id/cancel");
}
