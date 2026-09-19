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

/**
 * A rodada aceita palpites/compra agora?
 * O servidor já manda a resposta pronta em `can_pick` (inclui a regra
 * "1º jogo − 2h"); se o campo não vier, refaz a conta com closes_at/deadline.
 */
export function isRoundClosed(round) {
  if (!round) return true;
  if (round.can_pick === true) return false;
  if (round.can_pick === false) return true;
  if (round.status && round.status !== "open") return true;
  const at = round.closes_at || round.deadline;
  return at ? new Date(at).getTime() <= Date.now() : false;
}

/** Instante real de fechamento da rodada — alvo do contador. */
export function roundClosesAt(round) {
  if (!round) return null;
  return round.closes_at || round.deadline || null;
}