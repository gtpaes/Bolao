/* js/api/rounds.js — Rodadas (GET /api/rounds, GET /api/rounds/current) */
import { request, API } from "./client.js";

export async function getCurrentRound() {
  if (!API.mock) return request("/rounds/current");
  // Nenhuma rodada iniciada — a UI mostra estado vazio.
  return { round: null, meta: { source: "local" } };
}

export async function listRounds() {
  if (!API.mock) return request("/rounds");
  return { rounds: [] };
}

export async function getRound(id) {
  if (!API.mock) return request(`/rounds/${id}`);
  return { round: null };
}