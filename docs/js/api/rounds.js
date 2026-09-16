/* js/api/rounds.js — Rodadas (GET /api/rounds, GET /api/rounds/current) */
import { request, API, delay } from "./client.js";

export async function getCurrentRound() {
  if (!API.mock) return request("/rounds/current");
  await delay(300);
  // Nenhuma rodada iniciada — a UI mostra estado vazio.
  return { round: null, meta: { source: "local" } };
}

export async function listRounds() {
  if (!API.mock) return request("/rounds");
  await delay(300);
  return { rounds: [] };
}

export async function getRound(id) {
  if (!API.mock) return request(`/rounds/${id}`);
  await delay(300);
  return { round: null };
}