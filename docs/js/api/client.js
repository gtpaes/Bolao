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
 * - Override manual via window.API_BASE (útil para testes).
 * - Backend servindo o próprio frontend (porta 3001): mesma origem, "/api".
 * - Localhost (Live Server :5500, arquivo, etc.): backend LOCAL (localhost:3001).
 * - Frontend publicado (GitHub Pages, Render static): backend remoto (Render).
 * Local e produção compartilham apenas o MongoDB Atlas.
 */
function resolveBaseURL() {
  if (typeof window !== "undefined" && window.API_BASE) return String(window.API_BASE).replace(/\/$/, "");
  if (typeof window === "undefined") return LOCAL_API;
  const { protocol, hostname, port } = window.location;
  const isLocal = protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1";
  if (port === "3001") return "/api";
  if (isLocal) return LOCAL_API;
  return API_URL_REMOTO || LOCAL_API;
}

/** Backend local. */
const LOCAL_API = "http://localhost:3001/api";
/** Backend hospedado (Render), usado só quando o frontend está no ar. */
const API_URL_REMOTO = "https://bolao-api-00mh.onrender.com/api";

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
  // Sessao invalida/expirada ou token de outro backend: limpa e volta ao login.
  if (res.status === 401 && !path.startsWith("/auth/")) {
    try {
      localStorage.removeItem("bolao.session");
      localStorage.removeItem("bolao.profile");
    } catch (e) { /* noop */ }
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("login.html");
    }
  }
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

/** Sem atrasos artificiais: a UI deve responder imediatamente ao backend. */
export const delay = () => Promise.resolve();
