/* js/api/picks.js — Apostas públicas da rodada. */
import { request, API } from "./client.js";

export async function listPublicPicks(roundId) {
  if (!API.mock) return request(`/picks/public${roundId ? `?round=${encodeURIComponent(roundId)}` : ""}`);
  return { round: null, tickets: [] };
}
