/* js/api/picks.js — Apostas públicas da rodada. */
import { request, API } from "./client.js";

export async function listPublicPicks(roundId) {
  const params = new URLSearchParams();
  if (roundId) params.set("round", roundId);
  const query = params.toString();
  if (!API.mock) return request(`/picks/public${query ? `?${query}` : ""}`);
  return { round: null, tickets: [], visible: false };
}

export async function getPublicTicket(ticketId, roundId) {
  const params = new URLSearchParams({ ticket: ticketId });
  if (roundId) params.set("round", roundId);
  if (!API.mock) return request(`/picks/public?${params.toString()}`);
  return { round: null, tickets: [], visible: false };
}
