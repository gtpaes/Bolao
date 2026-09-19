import { request, API } from "./client.js";

export async function getProfileStats() {
  if (!API.mock) return request("/users/me/stats");
  return { stats: { tickets: 0, points: 0, rounds: null, bestPosition: null } };
}

export async function updateProfile(username) {
  return request("/users/me", { method: "PATCH", body: { username } });
}

export async function changePassword(currentPassword, newPassword) {
  return request("/users/me/password", { method: "POST", body: { currentPassword, newPassword } });
}