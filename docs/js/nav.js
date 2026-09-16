/* js/nav.js — Configuração e geração da navegação (sidebar, mobile, "mais") */

const MAIN = [
  { route: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { route: "round", label: "Rodada", icon: "calendar-clock" },
  { route: "picks", label: "Palpites", icon: "target" },
  { route: "tickets", label: "Meus Tickets", icon: "ticket" },
  { route: "ranking", label: "Ranking", icon: "list-ordered" },
  { route: "live", label: "Ao Vivo", icon: "radio" },
  { route: "buy", label: "Comprar Tickets", icon: "shopping-cart" },
  { route: "profile", label: "Meu Perfil", icon: "user" },
  { route: "history", label: "Histórico", icon: "history" },
];

const ADMIN = [
  { route: "admin", label: "Dashboard Admin", icon: "shield" },
  { route: "admin/round", label: "Gerenciar Rodada", icon: "settings-2" },
  { route: "admin/matches", label: "Gerenciar Jogos", icon: "volleyball" },
  { route: "admin/users", label: "Gerenciar Usuários", icon: "users" },
  { route: "admin/tickets", label: "Gerenciar Tickets", icon: "ticket-percent" },
  { route: "admin/settings", label: "Configurações", icon: "sliders-horizontal" },
  { route: "admin/logs", label: "Logs Admin", icon: "scroll-text" },
];

const DEV = [
  { route: "dev", label: "Dashboard Dev", icon: "code-2" },
  { route: "dev/monitoring", label: "Monitoramento", icon: "activity" },
  { route: "dev/integrations", label: "API/Integrações", icon: "plug" },
  { route: "dev/logs", label: "Logs do Sistema", icon: "terminal" },
  { route: "dev/diagnostics", label: "Diagnóstico", icon: "stethoscope" },
];

const MOBILE_PRIMARY = ["dashboard", "round", "picks", "tickets", "ranking"];

export function roleLinks(role) {
  const links = [...MAIN];
  if (role === "admin") links.push(...ADMIN);
  if (role === "dev") links.push(...ADMIN, ...DEV);
  return links;
}

function linkHtml(item, active) {
  const href = item.route === "dashboard" ? "#/" : "#/" + item.route;
  return `
    <a href="${href}" class="sb-link ${active ? "active" : ""}" data-route="${item.route}">
      <span class="sb-ico"><i data-lucide="${item.icon}"></i></span>
      <span>${item.label}</span>
    </a>`;
}

/**
 * Gera a sidebar completa (desktop). Retorna string HTML.
 */
export function sidebarHtml(role) {
  let nav = "";
  if (role === "user" || role === "admin" || role === "dev") {
    nav += `<div class="sb-group-label">Início</div>` + MAIN.map((it) => linkHtml(it, false)).join("");
  }
  if (role === "admin") nav += `<div class="sb-group-label">Administração</div>` + ADMIN.map((it) => linkHtml(it, false)).join("");
  if (role === "dev") nav += `<div class="sb-group-label">Administração</div>` + ADMIN.map((it) => linkHtml(it, false)).join("") + `<div class="sb-group-label">Desenvolvedor</div>` + DEV.map((it) => linkHtml(it, false)).join("");
  return nav;
}

/**
 * Gera a bottom navigation mobile.
 */
export function bottomNavHtml() {
  const items = MOBILE_PRIMARY.map((route) => {
    const def = MAIN.find((m) => m.route === route);
    const href = route === "dashboard" ? "#/" : "#/" + route;
    return `<li><a href="${href}" data-route="${route}" aria-label="${def.label}"><i data-lucide="${def.icon}"></i><span>${def.label.split(" ")[0]}</span></a></li>`;
  }).join("");
  return `<ul>${items}
    <li><button class="bn-more-btn" id="bn-more" aria-haspopup="true" aria-label="Mais opções"><i data-lucide="layers"></i><span>Mais</span></button></li>
  </ul>`;
}

/**
 * Gera o sheet "mais" (mobile) com todas as rotas.
 */
export function moreSheetHtml(role) {
  const links = roleLinks(role);
  return links.map((it) => `
    <a href="#/${it.route === "dashboard" ? "" : it.route}" data-close-sheet>
      <span class="ms-ico"><i data-lucide="${it.icon}"></i></span>
      <span>${it.label}</span>
    </a>`).join("");
}