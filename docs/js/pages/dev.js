/* js/pages/dev.js — Páginas da área dev */
import { loadTemplate, run } from "./loader.js";
import { esc } from "../../utils/dom.js";
import { available } from "../../utils/storage.js";
import { getTheme } from "../theme.js";
import { toastInfo } from "../../components/toast.js";
import { stateNode } from "../../utils/states.js";

/* Dashboard Dev */
export async function devDashboard(view) {
  await loadTemplate(view, "dev/dashboard.html");
  await run(view, async () => {
    const stats = [
      { ico: "database", label: "Usuários", value: "—" },
      { ico: "calendar-clock", label: "Rodadas", value: "—" },
      { ico: "ticket", label: "Tickets", value: "—" },
      { ico: "plug", label: "Serviços", value: "—" },
    ];
    view.querySelector("#dev-stats").replaceChildren(...stats.map(statCard));
    const ov = view.querySelector('[data-host="integrations-ov"]');
    ov.innerHTML = `
      <div class="card-header"><h2 class="card-title"><i data-lucide="activity"></i> Status dos serviços</h2></div>
      <div class="card-body">
        <div class="svc-row"><span class="svc-name"><span class="svc-dot offline"></span>Serviço de jogos</span><span class="badge badge-gray">Sem dados</span></div>
        <div class="svc-row"><span class="svc-name"><span class="svc-dot offline"></span>Pagamentos</span><span class="badge badge-gray">Sem dados</span></div>
        <div class="svc-row"><span class="svc-name"><span class="svc-dot offline"></span>API</span><span class="badge badge-gray">Sem dados</span></div>
        <div class="svc-row"><span class="svc-name"><span class="svc-dot offline"></span>Banco de dados</span><span class="badge badge-gray">Sem dados</span></div>
      </div>`;
  });
}

/* Monitoramento */
export async function devMonitoring(view) {
  await loadTemplate(view, "dev/monitoring.html");
  await run(view, async () => {
    const host = view.querySelector('[data-host="services"]');
    host.innerHTML = `
      <div class="card-header"><h2 class="card-title"><i data-lucide="radio"></i> Status dos serviços</h2></div>
      <div class="card-body">
        <div class="svc-row"><span class="svc-name"><span class="svc-dot offline"></span>Serviço de jogos</span><span class="badge badge-gray">Sem dados</span></div>
        <div class="svc-row"><span class="svc-name"><span class="svc-dot offline"></span>Pagamentos</span><span class="badge badge-gray">Sem dados</span></div>
        <div class="svc-row"><span class="svc-name"><span class="svc-dot offline"></span>API</span><span class="badge badge-gray">Sem dados</span></div>
        <div class="svc-row"><span class="svc-name"><span class="svc-dot offline"></span>Banco de dados</span><span class="badge badge-gray">Sem dados</span></div>
        <div class="divider"></div>
        <p class="t-muted t-small">Os indicadores mostram o estado atual dos serviços.</p>
      </div>`;
    view.querySelector("#dev-refresh").addEventListener("click", () => toastInfo("Verificado", "Nenhum serviço com dados no momento."));
  });
}
/* API/Integrações */
export async function devIntegrations(view) {
  await loadTemplate(view, "dev/integrations.html");
  await run(view, async () => {
    const endpoints = [
      ["GET", "/api/rounds/current", "Rodada atual", "pending"],
      ["GET", "/api/matches", "Jogos", "pending"],
      ["GET", "/api/matches/live", "Ao vivo", "pending"],
      ["POST", "/api/auth/register", "Registro", "ready-ui"],
      ["POST", "/api/auth/login", "Login", "ready-ui"],
      ["GET", "/api/users/me", "Perfil", "pending"],
      ["GET", "/api/tickets", "Tickets", "pending"],
      ["POST", "/api/tickets", "Compra (Pix)", "pending"],
      ["GET", "/api/ranking", "Ranking", "pending"],
    ];
    view.querySelector("#dev-endpoints-body").innerHTML = endpoints.map(([m, p, d, st]) => `
      <tr>
        <td><span class="badge badge-blue">${m}</span></td>
        <td class="t-mono">${esc(p)}</td>
        <td>${esc(d)}</td>
        <td>${st === "pending" ? '<span class="badge badge-gray">Sem dados</span>' : '<span class="badge badge-green">UI pronta</span>'}</td>
      </tr>`).join("");
  });
}

/* Logs do Sistema */
export async function devLogs(view) {
  await loadTemplate(view, "dev/logs.html");
  await run(view, async () => {
    const host = view.querySelector('[data-host="dev-logs"]');
    host.replaceChildren(stateNode("off", { title: "Logs do sistema", message: "Nenhum registro encontrado." }));
    view.querySelector("#dev-log-refresh").addEventListener("click", () => toastInfo("Atualizado", "Sem registros por agora."));
  });
}

/* Diagnóstico */
export async function devDiagnostics(view) {
  await loadTemplate(view, "dev/diagnostics.html");
  await run(view, async () => {
    const host = view.querySelector('[data-host="diagnostics"]');
    const runAll = () => host.replaceChildren(...checks());
    view.querySelector("#dev-diag-run").addEventListener("click", runAll);
    runAll();
  });
}

function checks() {
  return [
    diag("Ambiente", "OK", "success"),
    diag("Tema atual", getTheme(), "info"),
    diag("Armazenamento local", available() ? "Disponível" : "Bloqueado", "warn"),
    diag("Camada de API", "Modo local", "warn"),
    diag("Conexão com a API", "Sem dados no momento", "warn"),
  ];
}

function diag(label, result, lvl) {
  const c = document.createElement("div");
  c.className = "card card-pad-sm";
  c.innerHTML = `<div class="li"><span class="li-key">${esc(label)}</span><span class="li-val ${lvl === "success" ? "t-green" : ""}">${esc(result)}</span></div>`;
  return c;
}

function statCard(s) {
  const c = document.createElement("div");
  c.className = "card";
  c.innerHTML = `<div class="stat"><span class="ico-wrap"><i data-lucide="${s.ico}"></i></span><span class="stat-value">${esc(s.value)}</span><span class="stat-label">${esc(s.label)}</span></div>`;
  return c;
}