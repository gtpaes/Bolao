/* js/api/payments.js — Pagamentos Pix.
   NÃO gera QR Code nem simula aprovação aqui. Só prepara a UI. */
import { request, API, delay, operationPending } from "./client.js";

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
  await delay(200);
  // Nenhuma cobrança ativa — status desconhecido.
  return { status: "unknown", message: "sem dados" };
}