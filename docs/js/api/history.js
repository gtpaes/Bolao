/* js/api/history.js — Histórico real do usuário. */
import { request, API } from "./client.js";

export async function listHistory({ round, status } = {}) {
  const params = new URLSearchParams();
  if (round && round !== "all") params.set("round", round);
  if (status && status !== "all") params.set("status", status);
  const query = params.toString();
  if (!API.mock) return request(`/history${query ? `?${query}` : ""}`);
  return { history: [] };
}
