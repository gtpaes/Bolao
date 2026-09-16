/* js/api/matches.js — Jogos (GET /api/matches, GET /api/matches/live).
   Nenhum placar/resultado é inventado neste frontend. */
import { request, API, delay } from "./client.js";

export async function listMatches(roundId) {
  if (!API.mock) return request(`/matches${roundId ? "?round=" + roundId : ""}`);
  await delay(300);
  // Nenhum jogo disponível ainda (a rodada não foi configurada).
  return { matches: [] };
}

export async function listLive() {
  if (!API.mock) return request("/matches/live");
  await delay(300);
  return { matches: [] };
}