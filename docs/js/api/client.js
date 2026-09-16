/* ============================================================
   js/api/client.js — Camada central de API.

   CONTRATO DA API:
   - Os módulos em js/api/* expõem funções para consumir a API.
   - Quando não há dados, a camada retorna estados vazios
     (null / []) e a UI exibe o estado vazio correspondente.
   - Nenhuma chave ou segredo existe neste frontend.
     As chaves ficam apenas no servidor.

   Endpoints:
   GET  /api/rounds, GET /api/rounds/current
   GET  /api/matches, GET /api/matches/live
   POST /api/auth/register, POST /api/auth/login, GET /api/users/me
   GET/POST /api/tickets, GET /api/ranking
   ============================================================ */

/**
 * Resolve a base da API:
 * - Servido pelo próprio backend (porta 3001): mesma origem, "/api".
 * - Servido por outro servidor (Live Server etc.) ou aberto por arquivo:
 *   aponta para o backend local. Pode ser sobrescrito com window.API_BASE.
 */
function resolveBaseURL() {
  if (typeof window !== "undefined" && window.API_BASE) return String(window.API_BASE).replace(/\/$/, "");
  if (typeof window === "undefined") return "http://localhost:3001/api";
  const { protocol, port } = window.location;
  if (protocol === "file:") return API_URL_REMOTO || "http://localhost:3001/api";
  if (port === "3001") return "/api";
  // Frontend em outro servidor (ex.: Live Server :5500): usa o backend remoto (Render) quando configurado.
  return API_URL_REMOTO || "http://localhost:3001/api";
}

/** URL do backend hospedado (Render). Preencha com algo como "https://bolao-backend.onrender.com/api". */
const API_URL_REMOTO = "";

export const API = {
  baseURL: resolveBaseURL(),
  /** false = consome o backend real. */
  mock: false,
};

/**
 * Wrapper de fetch para a API. Só é usado quando API.mock === false.
 * Inclui o token salvo na sessão, quando houver.
 */
export async function request(path, { method = "GET", body, headers = {} } = {}) {
  if (API.baseURL.endsWith("/")) API.baseURL = API.baseURL.slice(0, -1);
  const opts = { method, headers: { "Content-Type": "application/json", ...headers } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const token = getSessionToken();
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API.baseURL + path, opts);
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { const j = await res.json(); msg = j.message || msg; } catch (e) { /* noop */ }
    throw new Error(msg);
  }
  return res.json();
}

/** Lê o token da sessão. */
import { get } from "../../utils/storage.js";
export function getSessionToken() {
  const s = get("session", null);
  return s && s.token ? s.token : null;
}

/**
 * Rejeita a operação com erro padrão — a UI traduz em estado de erro.
 */
export function operationPending(resource) {
  return Promise.reject(new Error(`Não foi possível concluir: ${resource}. Tente novamente.`));
}

/** Pequeno atraso opcional apenas para UX (evita flash em abas). Não é dado falso. */
export const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));