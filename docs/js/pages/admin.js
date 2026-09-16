/* js/pages/admin.js — Páginas da área administrativa */
import { loadTemplate, run } from "./loader.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { brl, dateShort } from "../../utils/format.js";
import { getCurrentRound, listRounds } from "../api/rounds.js";
import { openModal } from "../../components/modal.js";
import { toastSuccess, toastInfo, toastError } from "../../components/toast.js";
import { request } from "../api/client.js";
import { currentRole } from "../api/auth.js";

/* ---------------- Dashboard Admin ---------------- */
export async function adminDashboard(view) {
  await loadTemplate(view, "admin/dashboard.html");
  await run(view, async () => {
    const stats = [
      { ico: "users", label: "Usuários", value: "—" },
      { ico: "calendar-clock", label: "Rodadas", value: "—" },
      { ico: "ticket", label: "Tickets", value: "—" },
      { ico: "circle-dollar-sign", label: "Receitas", value: "—" },
    ];
    view.querySelector("#admin-stats").replaceChildren(...stats.map(statCard));

    const curHost = view.querySelector('[data-host="current-round"]');
    let round = null;
    try { round = (await getCurrentRound()).round; } catch (e) { round = null; }
    if (round) {
      curHost.innerHTML = `
        <div class="li"><span class="li-key">Rodada</span><span class="li-val">${esc(String(round.number))}</span></div>
        <div class="li"><span class="li-key">Status</span><span class="li-val">${esc(String(round.status || "—"))}</span></div>`;
    } else {
      curHost.replaceChildren(stateNode("empty", { title: "Sem rodada aberta", message: "Crie ou abra uma rodada para começar." }));
    }
  });
}

/* ---------------- Gerenciar Rodada ---------------- */
export async function adminRound(view) {
  await loadTemplate(view, "admin/round.html");
  await run(view, async () => {
    const formHost = view.querySelector('[data-host="round-form"]');
    let rounds = [];
    try { rounds = (await listRounds()).rounds || []; } catch (e) { rounds = []; }
    const current = rounds[0] || null;

    formHost.innerHTML = `
      <div class="card">
        <div class="card-header"><h2 class="card-title"><i data-lucide="calendar-clock"></i> Configuração da rodada</h2></div>
        <div class="card-body">
          <div class="grid grid-2">
            <div class="field"><label for="r-number">Número de rodada</label><input class="input" id="r-number" type="number" min="1" value="${current ? esc(current.number) : ""}" placeholder="Ex. 3" /></div>
            <div class="field"><label for="r-status">Status</label><select class="select" id="r-status"><option value="open">Aberto</option><option value="closed">Fechado</option></select></div>
            <div class="field"><label for="r-open">Abertura</label><input class="input" id="r-open" type="datetime-local" /></div>
            <div class="field"><label for="r-close">Fechamento</label><input class="input" id="r-close" type="datetime-local" /></div>
          </div>
          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
            <button class="btn btn-primary" id="r-save"><i data-lucide="save"></i> Salvar</button>
            <button class="btn btn-ghost" id="r-close">Fechar rodada</button>
            <button class="btn btn-ghost" id="r-reopen">Reabrir rodada</button>
          </div>
        </div>
      </div>`;

    view.querySelector("#r-save").addEventListener("click", () => toastSuccess("Salvo", "Configuração da rodada salva nesta sessão."));
    view.querySelector("#r-close").addEventListener("click", () => toastInfo("Fechamento", "A rodada foi marcada como fechada nesta sessão."));
    view.querySelector("#r-reopen").addEventListener("click", () => toastInfo("Reabertura", "A rodada foi marcada como aberta nesta sessão."));

    const facts = view.querySelector('[data-host="round-facts"]');
    facts.replaceChildren(stateNode("off", { title: "Dados da rodada", message: "Sem dados no momento." }));
  });
}
/* ---------------- Gerenciar Jogos ---------------- */
export async function adminMatches(view) {
  await loadTemplate(view, "admin/matches.html");
  await run(view, async () => {
    const host = view.querySelector('[data-host="admin-matches"]');
    host.replaceChildren(stateNode("off", { title: "Jogos da rodada", message: "Nenhum jogo cadastrado." }));

    view.querySelector("#admin-add-match").addEventListener("click", () => {
      const body = document.createElement("div");
      body.innerHTML = `
        <div class="field"><label for="m-home">Equipe local</label><input class="input" id="m-home" /></div>
        <div class="field"><label for="m-away">Equipe visitante</label><input class="input" id="m-away" /></div>
        <div class="field"><label for="m-date">Data e hora</label><input class="input" id="m-date" type="datetime-local" /></div>
        <p class="t-muted t-small">Os jogos salvos aparecem na lista da rodada.</p>`;
      openModal({
        title: "Adicionar jogo",
        body,
        footer: `<button class="btn btn-primary" data-add>Salvar</button>`,
      }).overlay.querySelector("[data-add]").addEventListener("click", () => toastSuccess("Jogo salvo", "O jogo foi adicionado nesta sessão."));
    });
  });
}

/* ---------------- Gerenciar Usuários ---------------- */
export async function adminUsers(view) {
  await loadTemplate(view, "admin/users.html");
  await run(view, async () => {
    const body = view.querySelector("#admin-users-body");
    const isDev = String(currentRole()) === "dev";

    let users = [];
    try {
      const res = await request("/admin/users");
      users = (res && res.users) || [];
    } catch (e) {
      users = [];
    }

    if (!users.length) {
      body.innerHTML = `<tr><td colspan="5">${emptyRowCell("Nenhum usuário encontrado.")}</td></tr>`;
      return;
    }

    const badge = (r) => {
      const map = { dev: "badge", admin: "badge", user: "badge badge-muted" };
      return `<span class="${map[r] || "badge badge-muted"}">${esc(r)}</span>`;
    };

    body.replaceChildren(...users.map((u) => {
      const tr = document.createElement("tr");
      const roleCell = isDev && u.role !== "dev"
        ? `${badge(u.role)} <button class="btn btn-soft btn-sm" data-role-btn data-id="${esc(u.id)}" data-next="${u.role === "admin" ? "user" : "admin"}">${u.role === "admin" ? "Remover admin" : "Tornar admin"}</button>`
        : badge(u.role);
      tr.innerHTML = `
        <td>${esc(u.username)}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(dateShort(u.createdAt))}</td>
        <td>${roleCell}</td>
        <td>—</td>`;
      return tr;
    }));

    if (isDev) {
      body.querySelectorAll("[data-role-btn]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const nextRole = btn.dataset.next;
          btn.disabled = true;
          try {
            const res = await request(`/admin/users/${id}/role`, { method: "PATCH", body: { role: nextRole } });
            const u = (res && res.user) || {};
            toastSuccess("Papel atualizado", `${u.username || "Usuário"} agora é ${u.role}.`);
            btn.textContent = nextRole === "admin" ? "Remover admin" : "Tornar admin";
            btn.dataset.next = nextRole === "admin" ? "user" : "admin";
            const b = btn.previousElementSibling;
            if (b && b.classList.contains("badge")) b.textContent = u.role;
          } catch (e) {
            toastError("Não foi possível atualizar", e.message || "Tente novamente.");
          } finally {
            btn.disabled = false;
          }
        });
      });
    }
  });
}

/* ---------------- Gerenciar Tickets ---------------- */
export async function adminTickets(view) {
  await loadTemplate(view, "admin/tickets.html");
  await run(view, async () => {
    const body = view.querySelector("#admin-tickets-body");
    body.innerHTML = `<tr><td colspan="5">${emptyRowCell("Nenhum ticket encontrado.")}</td></tr>`;
  });
}

/* ---------------- Configurações ---------------- */
export async function adminSettings(view) {
  await loadTemplate(view, "admin/settings.html");
  await run(view, async () => {
    view.querySelector("#cfg-save").addEventListener("click", () => toastSuccess("Configuração", "Configurações salvas nesta sessão."));
  });
}

/* ---------------- Logs Admin ---------------- */
export async function adminLogs(view) {
  await loadTemplate(view, "admin/logs.html");
  await run(view, async () => {
    const host = view.querySelector('[data-host="admin-logs"]');
    host.replaceChildren(stateNode("off", { title: "Logs de administração", message: "Nenhum registro encontrado." }));
    view.querySelector("#admin-log-refresh").addEventListener("click", () => toastInfo("Atualizado", "Nenhum registro para exibir."));
  });
}

/* ---------------- helpers ---------------- */
function statCard(s) {
  const c = document.createElement("div");
  c.className = "card";
  c.innerHTML = `<div class="stat"><span class="ico-wrap"><i data-lucide="${s.ico}"></i></span><span class="stat-value">${esc(s.value)}</span><span class="stat-label">${esc(s.label)}</span></div>`;
  return c;
}
function emptyRowCell(msg) {
  return `<div class="state" style="padding:var(--space-6)"><span class="state-ico muted"><i data-lucide="database"></i></span><h3>Sem dados</h3><p>${esc(msg)}</p></div>`;
}