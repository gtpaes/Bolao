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
    let overview = { users: 0, rounds: 0, tickets: 0, revenueCents: 0 };
    try { overview = await request("/admin/overview"); } catch (e) { toastError("Dashboard indisponível", e.message); }
    const stats = [
      { ico: "users", label: "Usuários", value: String(overview.users || 0) },
      { ico: "calendar-clock", label: "Rodadas", value: String(overview.rounds || 0) },
      { ico: "ticket", label: "Tickets pagos", value: String(overview.tickets || 0) },
      { ico: "circle-dollar-sign", label: "Receitas", value: brl((overview.revenueCents || 0) / 100) },
    ];
    view.querySelector("#admin-stats").replaceChildren(...stats.map(statCard));

    const curHost = view.querySelector('[data-host="current-round"]');
    let round = null;
    round = overview.currentRound || null;
    if (round) {
      curHost.innerHTML = `
        <div class="li"><span class="li-key">Rodada</span><span class="li-val">${esc(String(round.number))}</span></div>
        <div class="li"><span class="li-key">Status</span><span class="li-val">${esc(String(round.status || "—"))}</span></div>
        <div class="li"><span class="li-key">Fechamento</span><span class="li-val">${esc(dateShort(round.deadline))}</span></div>`;
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
            <div class="field"><label for="r-close-at">Fechamento</label><input class="input" id="r-close-at" type="datetime-local" /></div>
          </div>
          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
            <button class="btn btn-primary" id="r-save"><i data-lucide="save"></i> Salvar</button>
            <button class="btn btn-ghost" id="r-close">Fechar rodada</button>
            <button class="btn btn-ghost" id="r-reopen">Reabrir rodada</button>
          </div>
        </div>
      </div>`;

    const roundId = current && current.id;
    view.querySelector("#r-save").addEventListener("click", async () => {
      if (!roundId) return toastError("Rodada não encontrada", "Sincronize uma rodada primeiro.");
      try {
        const deadline = view.querySelector("#r-close-at").value;
        await request(`/admin/rounds/${roundId}/deadline`, { method: "PATCH", body: { deadline } });
        toastSuccess("Salvo", "Deadline atualizado.");
      } catch (e) { toastError("Não foi possível salvar", e.message); }
    });
    view.querySelector("#r-close").addEventListener("click", async () => {
      try { await request(`/admin/rounds/${roundId}/close`, { method: "POST" }); toastSuccess("Rodada fechada", "Novos palpites foram bloqueados."); }
      catch (e) { toastError("Não foi possível fechar", e.message); }
    });
    view.querySelector("#r-reopen").addEventListener("click", async () => {
      try { await request(`/admin/rounds/${roundId}/reopen`, { method: "POST" }); toastSuccess("Rodada reaberta", "Palpites liberados novamente."); }
      catch (e) { toastError("Não foi possível reabrir", e.message); }
    });

  });
}
/* ---------------- Gerenciar Jogos ---------------- */
export async function adminMatches(view) {
  await loadTemplate(view, "admin/matches.html");
  await run(view, async () => {
    const host = view.querySelector('[data-host="admin-matches"]');
    let round = null;
    try {
      await request("/admin/sync/round", { method: "POST", body: {} });
      round = (await getCurrentRound()).round;
    } catch (e) {
      host.replaceChildren(stateNode("error", { title: "Não foi possível sincronizar", message: e.message || "Verifique a API de futebol." }));
      return;
    }
    if (!round) {
      host.replaceChildren(stateNode("empty", { title: "Nenhuma rodada encontrada", message: "Sincronize uma rodada antes de selecionar os jogos." }));
      return;
    }
    let matches = [];
    try {
      matches = (await request(`/admin/rounds/${round.id}/matches`)).matches || [];
    } catch (e) {
      host.replaceChildren(stateNode("error", { title: "Não foi possível carregar os jogos", message: e.message || "Tente novamente." }));
      return;
    }
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="card-header"><h2 class="card-title">Rodada ${esc(round.number)} — selecione os jogos do ticket</h2></div><div class="card-body"><div data-match-list></div><button class="btn btn-primary" data-save-matches><i data-lucide="save"></i> Salvar jogos selecionados</button></div>`;
    const list = card.querySelector("[data-match-list]");
    if (!matches.length) {
      list.appendChild(stateNode("empty", { title: "Nenhum jogo encontrado", message: "A API ainda não retornou jogos para esta rodada." }));
    } else {
      for (const match of matches) {
        const label = document.createElement("label");
        label.className = "field";
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.flexWrap = "wrap";
        label.style.gap = "var(--space-3)";
        label.innerHTML = `<input type="checkbox" value="${esc(match.externalId)}" ${match.enabled_for_tickets ? "checked" : ""} /><span>${esc(match.home)} x ${esc(match.away)}</span><span class="t-muted t-small">${esc(match.status || "")}</span>`;
        list.appendChild(label);
      }
    }
    host.replaceChildren(card);
    card.querySelector("[data-save-matches]").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const matchIds = [...list.querySelectorAll("input[type=checkbox]:checked")].map((input) => Number(input.value));
        const result = await request(`/admin/rounds/${round.id}/matches`, { method: "PATCH", body: { matchIds } });
        toastSuccess("Jogos salvos", `${result.selectedCount} jogo(s) entrarão nos tickets.`);
      } catch (e) {
        toastError("Não foi possível salvar", e.message || "Tente novamente.");
      } finally {
        button.disabled = false;
      }
    });

    view.querySelector("#admin-add-match").addEventListener("click", () => {
      const body = document.createElement("div");
      body.innerHTML = `
        <div class="field"><label for="m-home">Equipe local</label><input class="input" id="m-home" /></div>
        <div class="field"><label for="m-away">Equipe visitante</label><input class="input" id="m-away" /></div>
        <div class="field"><label for="m-date">Data e hora</label><input class="input" id="m-date" type="datetime-local" /></div>
        <p class="t-muted t-small">Os jogos salvos aparecem na lista da rodada.</p>`;
      const modal = openModal({
        title: "Adicionar jogo",
        body,
        footer: `<button class="btn btn-primary" data-add>Salvar</button>`,
      });
      modal.overlay.querySelector("[data-add]").addEventListener("click", async () => {
        try {
          await request(`/admin/rounds/${round.id}/matches`, { method: "POST", body: { home: modal.overlay.querySelector("#m-home").value, away: modal.overlay.querySelector("#m-away").value, startsAt: modal.overlay.querySelector("#m-date").value || null } });
          modal.overlay.remove();
          toastSuccess("Jogo salvo", "O jogo manual foi adicionado à rodada.");
        } catch (e) { toastError("Não foi possível adicionar", e.message); }
      });
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
    try {
      const data = await request("/admin/tickets");
      const tickets = data.tickets || [];
      if (!tickets.length) { body.innerHTML = `<tr><td colspan="5">${emptyRowCell("Nenhum ticket encontrado.")}</td></tr>`; return; }
      body.innerHTML = tickets.map((ticket) => `<tr><td>Ticket ${esc(String(ticket.number))}</td><td>${esc(ticket.user)}</td><td>${esc(String(ticket.round || "—"))}</td><td>${esc(ticket.status)}</td><td>${esc(String(ticket.points || 0))}</td></tr>`).join("");
    } catch (e) { body.innerHTML = `<tr><td colspan="5">${emptyRowCell(e.message || "Não foi possível carregar os tickets.")}</td></tr>`; }
  });
}

/* ---------------- Configurações ---------------- */
export async function adminSettings(view) {
  await loadTemplate(view, "admin/settings.html");
  await run(view, async () => {
    try {
      const data = await request("/admin/settings");
      const settings = data.settings || {};
      const points = settings.points || {};
      view.querySelector("#cfg-exact").value = points.exact ?? 10;
      view.querySelector("#cfg-draw").value = points.draw ?? 6;
      view.querySelector("#cfg-winner").value = points.winner ?? 4;
      view.querySelector("#cfg-miss").value = points.miss ?? 0;
      view.querySelector("#cfg-price").value = ((settings.priceCents ?? 1000) / 100).toFixed(2);
      view.querySelector("#cfg-auto-close").checked = settings.autoClose !== false;
    } catch (e) { toastError("Não foi possível carregar", e.message); }
    view.querySelector("#cfg-save").addEventListener("click", async () => {
      try {
        await request("/admin/settings", { method: "PATCH", body: { priceCents: Math.round(Number(view.querySelector("#cfg-price").value) * 100), autoClose: view.querySelector("#cfg-auto-close").checked, points: { exact: Number(view.querySelector("#cfg-exact").value), draw: Number(view.querySelector("#cfg-draw").value), winner: Number(view.querySelector("#cfg-winner").value), miss: Number(view.querySelector("#cfg-miss").value) } } });
        toastSuccess("Regras salvas", "Valem para todas as rodadas — nada de salvar rodada por rodada.");
      } catch (e) { toastError("Não foi possível salvar", e.message); }
    });
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