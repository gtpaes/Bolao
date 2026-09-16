/* js/api/ranking.js — Ranking (GET /api/ranking) */
import { request, API, delay } from "./client.js";

export async function getRanking(roundId) {
  if (!API.mock) return request(`/ranking${roundId ? "?round=" + roundId : ""}`);
  await delay(300);
  // Ranking vazio. A interface mostra estado vazio.
  return { ranking: [], myPosition: null };
}