/* js/router.js — Roteador hash + navegação por perfil */

import { requireAuth, currentRole, currentProfile } from "./api/auth.js";
import { hydrateIcons, qsa } from "../utils/dom.js";
import { pages } from "./pages/index.js";

const ROUTES = [
  // Área do usuário
  { path: "dashboard", title: "Dashboard", role: ["user", "admin", "dev"] },
  { path: "round", title: "Rodada", role: ["user", "admin", "dev"] },
  { path: "picks", title: "Fazer Palpites", role: ["user", "admin", "dev"] },
  { path: "bets", title: "Apostas da Rodada", role: ["user", "admin", "dev"] },
  { path: "tickets", title: "Meus Tickets", role: ["user", "admin", "dev"] },
  { path: "buy", title: "Comprar Tickets", role: ["user", "admin", "dev"] },
  { path: "payment", title: "Pagamento", role: ["user", "admin", "dev"] },
  { path: "ranking", title: "Ranking", role: ["user", "admin", "dev"] },
  { path: "live", title: "Jogos ao Vivo", role: ["user", "admin", "dev"] },
  { path: "profile", title: "Meu Perfil", role: ["user", "admin", "dev"] },
  { path: "history", title: "Histórico", role: ["user", "admin", "dev"] },
  // Admin
  { path: "admin", title: "Dashboard Admin", role: ["admin", "dev"] },
  { path: "admin/round", title: "Gerenciar Rodada", role: ["admin", "dev"] },
  { path: "admin/matches", title: "Gerenciar Jogos", role: ["admin", "dev"] },
  { path: "admin/users", title: "Gerenciar Usuários", role: ["admin", "dev"] },
  { path: "admin/tickets", title: "Gerenciar Tickets", role: ["admin", "dev"] },
  { path: "admin/settings", title: "Configurações", role: ["admin", "dev"] },
  { path: "admin/logs", title: "Logs Admin", role: ["admin", "dev"] },
  // Dev
  { path: "dev", title: "Dashboard Dev", role: ["dev"] },
  { path: "dev/monitoring", title: "Monitoramento", role: ["dev"] },
  { path: "dev/integrations", title: "API/Integrações", role: ["dev"] },
  { path: "dev/logs", title: "Logs do Sistema", role: ["dev"] },
  { path: "dev/diagnostics", title: "Diagnóstico", role: ["dev"] },
];

export async function initRouter() {
  render();
  window.addEventListener("hashchange", render);
}

export function navigate(path) {
  location.hash = path === "dashboard" ? "/" : "/" + path;
}

export function currentPath() {
  const raw = (location.hash || "#/").replace(/^#\/?/, "");
  return raw.split("/")[0] || "dashboard";
}

function currentFullPath() {
  const raw = (location.hash || "#/").replace(/^#\/?/, "");
  return raw || "dashboard";
}

async function render() {
  if (!requireAuth()) return;
  const full = currentFullPath();
  const role = currentRole() || "user";
  const route = ROUTES.find((r) => r.path === full) ||
    ROUTES.find((r) => r.path === (typeOf(full) === "admin" ? "admin" : full.split("/")[0])) || null;
  const user = currentProfile();

  // Permissão por perfil
  if (route && !route.role.includes(role)) {
    // Acesso negado -> ir para o dashboard da sua área
    const fallback = role === "admin" ? "admin" : role === "dev" ? "dev" : "dashboard";
    location.hash = "/" + fallback;
    return;
  }

  setHeader(route, user);
  markNav(full);
  closeDrawer();

  const view = document.getElementById("app-view");
  view.innerHTML = `<div class="state" role="status"><span class="spinner"></span><p>Carregando seção…</p></div>`;

  const page = pages[full] || pages[fallbackPath(full, role)];
  if (!page) {
    view.innerHTML = `<div class="state"><span class="state-ico muted"><i data-lucide="file-question"></i></span><h3>Página não encontrada</h3><p></p></div>`;
    return;
  }
  document.title = (route && route.title ? route.title + " · " : "") + "Bolão de futebol";
  try {
    await page.render(view);
  } catch (e) {
    console.error(e);
    view.insertAdjacentHTML("beforeend", `
      <div class="state"><span class="state-ico danger"><i data-lucide="alert-circle"></i></span>
      <h3>Falha ao carregar</h3><p>${e && e.message ? e.message : "Erro inesperado."}</p></div>`);
  }
  hydrateIcons(view);
  window.scrollTo(0, 0);
}

function fallbackPath(full, role) {
  const first = full.split("/")[0];
  if (["admin", "dev"].includes(first)) {
    return role === first ? first : (role === "dev" ? "dev" : "dashboard");
  }
  if (!pages[first]) return "dashboard";
  return first;
}

function typeOf(full) {
  return full.split("/")[0];
}

function setHeader(route, user) {
  const t = document.getElementById("page-title");
  if (t) t.textContent = route && route.title ? route.title : "Bolão";
  const menuBtn = document.getElementById("menu-btn");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
}

function markNav(full) {
  const root = full.split("/")[0];
  qsa("[data-route]").forEach((a) => {
    const r = a.getAttribute("data-route");
    a.classList.toggle("active", r === full);
    if (a.classList.contains("active")) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
    void root;
  });
}

function closeDrawer() {
  const d = document.getElementById("sidebar-drawer");
  if (d) d.remove();
}