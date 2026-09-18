/* js/api/matches.js — Jogos (GET /api/matches, GET /api/matches/live).
   Nenhum placar/resultado é inventado neste frontend. */
import { request, API } from "./client.js";

export async function listMatches(roundId) {
  if (!API.mock) return request(`/matches${roundId ? "?round=" + roundId : ""}`);
  // Nenhum jogo disponível ainda (a rodada não foi configurada).
  return { matches: [] };
}

export async function listLive() {
  if (!API.mock) return request("/matches/live");
  return { matches: [] };
}