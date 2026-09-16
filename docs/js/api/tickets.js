/* js/api/tickets.js — Tickets (GET/POST /api/tickets). */
import { request, API, delay, operationPending } from "./client.js";

export async function listTickets() {
  if (!API.mock) return request("/tickets");
  await delay(300);
  // Nenhum ticket ainda. UI mostra estado vazio.
  return { tickets: [] };
}

export async function getTicket(id) {
  if (!API.mock) return request(`/tickets/${id}`);
  await delay(200);
  return { ticket: null };
}

export async function buyTickets({ quantity }) {
  if (!API.mock) return request("/tickets", { method: "POST", body: { quantity } });
  return operationPending("POST /api/tickets (pagamento Pix)");
}

export async function savePicks(ticketId, picks) {
  if (!API.mock) return request(`/tickets/${ticketId}/picks`, { method: "PUT", body: { picks } });
  return operationPending("salvar palpites");
}