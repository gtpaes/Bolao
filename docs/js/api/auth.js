/* ============================================================
   js/api/auth.js — Autenticação (backend real, JWT).

   - A senha nunca é armazenada no navegador.
   - O token vem do servidor e é usado apenas em memória de sessão.
   - A autorização definitiva é aplicada pelo servidor.
   ============================================================ */

import { get, set, remove } from "../../utils/storage.js";
import { request } from "./client.js";

const PROFILE_KEY = "profile";
const SESSION_KEY = "session";

/* ---------------- Sessão (leitura) ---------------- */
export function currentProfile() {
  return get(PROFILE_KEY, null);
}
export function currentSession() {
  return get(SESSION_KEY, null);
}
export function isAuthenticated() {
  return !!get(SESSION_KEY, null);
}
export function currentRole() {
  const s = get(SESSION_KEY, null);
  return s ? s.role : null;
}

/* ---------------- Registro (backend) ---------------- */
export async function register({ username, email, password }) {
  const data = await request("/auth/register", { method: "POST", body: { username, email, password } });
  // O cadastro retorna conta criada; o usuário entra pela tela de login.
  return { ok: true, data: data.user || null };
}

/* ---------------- Login (backend) ---------------- */
export async function login({ email, password }) {
  email = String(email || "").trim().toLowerCase();
  const data = await request("/auth/login", { method: "POST", body: { email, password } });
  const u = data.user || {};
  const session = {
    token: data.token,
    role: u.role || "user",
    userId: u.id || null,
    username: u.username || "",
    email: u.email || email,
  };
  set(SESSION_KEY, session);
  set(PROFILE_KEY, {
    id: u.id || null,
    username: u.username || "",
    email: u.email || email,
    role: u.role || "user",
    createdAt: u.createdAt || null,
  });
  return { ok: true, data: session };
}

/* ---------------- Logout ---------------- */
export function logout() {
  remove(SESSION_KEY);
}

/* ---------------- Guards ---------------- */
export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.replace("login.html");
    return false;
  }
  return true;
}
export function canAccess(...roles) {
  const role = currentRole();
  return role && roles.includes(role);
}