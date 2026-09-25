/* js/pages/admin.js — Páginas da área administrativa */
import { loadTemplate, run } from "./loader.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { brl, dateShort, dateTime } from "../../utils/format.js";
import { getCurrentRound, listRounds } from "../api/rounds.js";
import { openModal } from "../../components/modal.js";
import { toastSuccess, toastInfo, toastError } from "../../components/toast.js";
import { request } from "../api/client.js";
import { currentRole } from "../api/auth.js";

/* datetime-local espera "YYYY-MM-DDTHH:MM" no fuso local do navegador. */
function toLocalInput(v) {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
            { ico: "circle-dollar-sign", label: "Receita (líquida)", value: brl((overview.revenueCents || 0) / 100) },
    ];
    view.querySelector("#admin-stats").replaceChildren(...stats.map(statCard));

    const curHost = view.querySelector('[data-host="current-round"]');
    let round = null;
    round = overview.currentRound || null;
    if (round) {
      // Fechamento = instante real (deadline salvo ou 1º jogo − 2h), não só o deadline.
      const control = round.manualOverride ? "Manual (admin)" : "Automático";
      curHost.innerHTML = `
        <div class="li"><span class="li-key">Rodada</span><span class="li-val">${esc(String(round.number))}</span></div>
        <div class="li"><span class="li-key">Status</span><span class="li-val">${esc(String(round.status || "—"))}</span></div>
        <div class="li"><span class="li-key">Fechamento</span><span class="li-val">${esc(dateTime(round.closesAt || round.deadline))}</span></div>
        <div class="li"><span class="li-key">Controle</span><span class="li-val">${esc(control)}</span></div>`;
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

    // Instante real de fechamento: o deadline salvo no admin vence; senão, 2h antes
    // do 1º jogo. É esse valor que o campo de fechamento mostra.
    const closesAt = current ? (current.closes_at || current.deadline || null) : null;
    const controlHint = !current
      ? "Sincronize uma rodada para configurar."
      : current.manual_override
        ? "Controle manual: você fechou/reabriu esta rodada. A regra automática (2h antes do 1º jogo) está desligada até você voltar ao automático."
        : `Controle automático: fecha sozinha em ${dateTime(closesAt)} (2h antes do 1º jogo).`;
    const setControlHint = (text) => {
      const el = view.querySelector("#r-control");
      if (el) el.textContent = text;
    };

    formHost.innerHTML = `
      <div class="card">
        <div class="card-header"><h2 class="card-title"><i data-lucide="calendar-clock"></i> Configuração da rodada</h2></div>
        <div class="card-body">
          <div class="grid grid-2">
            <div class="field"><label for="r-number">Número de rodada</label><input class="input" id="r-number" type="number" min="1" value="${current ? esc(current.number) : ""}" placeholder="Ex. 3" /></div>
            <div class="field"><label for="r-status">Status</label><select class="select" id="r-status"><option value="open">Aberto</option><option value="closed">Fechado</option></select></div>
            <div class="field"><label for="r-open">Abertura</label><input class="input" id="r-open" type="datetime-local" /></div>
            <div class="field"><label for="r-close-at">Fechamento</label><input class="input" id="r-close-at" type="datetime-local" value="${esc(toLocalInput(closesAt))}" /></div>
          </div>
          <p class="t-muted t-small" id="r-control">${esc(controlHint)}</p>
          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
            <button class="btn btn-primary" id="r-save"><i data-lucide="save"></i> Salvar</button>
            <button class="btn btn-ghost" id="r-close">Fechar rodada</button>
            <button class="btn btn-ghost" id="r-reopen">Reabrir rodada</button>
            <button class="btn btn-ghost" id="r-automatic">Voltar ao automático</button>
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
    // Fechar/reabrir assume o controle manual: a rodada deixa de fechar sozinha até
    // o admin devolver ao automático.
    view.querySelector("#r-close").addEventListener("click", async () => {
      if (!roundId) return toastError("Rodada não encontrada", "Sincronize uma rodada primeiro.");
      try {
        const r = await request(`/admin/rounds/${roundId}/close`, { method: "POST" });
        const n = r.ticketsUpdated || 0;
        setControlHint("Controle manual: rodada fechada por você. A regra automática está desligada.");
        toastSuccess("Rodada fechada", `${n} ticket(s) bloqueado(s) para palpites.`);
      } catch (e) { toastError("Não foi possível fechar", e.message); }
    });
    view.querySelector("#r-reopen").addEventListener("click", async () => {
      if (!roundId) return toastError("Rodada não encontrada", "Sincronize uma rodada primeiro.");
      try {
        const r = await request(`/admin/rounds/${roundId}/reopen`, { method: "POST" });
        const n = r.ticketsUpdated || 0;
        setControlHint("Controle manual: rodada reaberta por você. A regra automática está desligada.");
        toastSuccess("Rodada reaberta", `${n} ticket(s) liberado(s) para palpites.`);
      } catch (e) { toastError("Não foi possível reabrir", e.message); }
    });
    view.querySelector("#r-automatic").addEventListener("click", async () => {
      if (!roundId) return toastError("Rodada não encontrada", "Sincronize uma rodada primeiro.");
      try {
        await request(`/admin/rounds/${roundId}/automatic`, { method: "POST" });
        setControlHint("Controle automático: a rodada volta a fechar 2h antes do 1º jogo.");
        toastSuccess("Controle automático", "A rodada volta a fechar sozinha 2h antes do 1º jogo.");
      } catch (e) { toastError("Não foi possível alterar", e.message); }
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

    // `?.` porque este id vem do template: se ele mudar, a página não estoura.
    view.querySelector("#admin-add-match")?.addEventListener("click", () => {
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
    const roundHost = view.querySelector('[data-host="tickets-round"]');

    let rounds = [];
    try { rounds = (await listRounds()).rounds || []; } catch (e) { rounds = []; }

    // Seletor de rodada (filtra a lista de tickets).
    const selWrap = document.createElement("div");
    selWrap.className = "card";
    selWrap.innerHTML = `<div class="card-header"><h2 class="card-title"><i data-lucide="calendar-clock"></i> Rodada</h2></div>
      <div class="card-body">
        ${rounds.length
          ? `<select class="input" id="admin-ticket-round-select"></select>`
          : stateNode("empty", { title: "Sem rodadas", message: "Sincronize uma rodada antes de administrar tickets." }).innerHTML}
      </div>`;
    const select = selWrap.querySelector("#admin-ticket-round-select");
    if (select) {
      select.innerHTML = rounds.map((r) => `<option value="${esc(r.id)}">Rodada ${esc(String(r.number))}${r.status ? ` — ${esc(r.status)}` : ""}</option>`).join("");
    }
    roundHost.replaceChildren(selWrap);
    if (window.lucide) window.lucide.createIcons({ nodes: [selWrap] });

    async function reloadTickets() {
      body.innerHTML = `<tr><td colspan="7"><div class="state" style="padding:var(--space-4)"><span class="state-ico muted"><i data-lucide="loader-circle"></i></span><h3>Carregando</h3></div></td></tr>`;
      const rid = select ? select.value : null;
      try {
        const url = rid ? `/admin/tickets?round=${rid}` : "/admin/tickets";
        const data = await request(url);
        const tickets = data.tickets || [];
        if (!tickets.length) { body.innerHTML = `<tr><td colspan="7">${emptyRowCell(rid ? "Nenhum ticket nesta rodada." : "Nenhum ticket encontrado.")}</td></tr>`; return; }
        body.innerHTML = tickets.map((ticket) => {
          const forma = ticket.paymentMethod === "manual" ? "Em mão" : "Pix";
          const titular = `<span>${esc(ticket.owner || "—")}</span>${ticket.user ? "" : ' <span class="badge">sem conta</span>'}`;
          const preco = ticket.priceCents ? brl(ticket.priceCents / 100) : "—";
          return `<tr>
            <td>Ticket ${esc(String(ticket.number))}</td>
            <td>${titular}</td>
            <td>${esc(String(ticket.round || "—"))}</td>
            <td>${esc(preco)}</td>
            <td>${esc(forma)}</td>
            <td>${esc(ticket.status)}</td>
            <td>${esc(String(ticket.points || 0))}</td>
          </tr>`;
        }).join("");
      } catch (e) {
        body.innerHTML = `<tr><td colspan="7">${emptyRowCell(e.message || "Não foi possível carregar os tickets.")}</td></tr>`;
      }
    }

    view.querySelector("#admin-ticket-manual").addEventListener("click", async () => {
      if (!rounds.length) return toastError("Sem rodadas", "Sincronize uma rodada antes.");
      await openManualSaleModal({
        rounds,
        defaultRoundId: select ? select.value : null,
        onCreated: async () => { await reloadTickets(); },
      });
    });

    if (select) {
      select.addEventListener("change", async () => { await reloadTickets(); });
    }

    await reloadTickets();
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

/* Modal de venda em mão (dinheiro, sem Pix): nome/número + titular opcional. */
async function openManualSaleModal({ rounds, defaultRoundId, onCreated }) {
  let users = [];
  try { users = (await request("/admin/users")).users || []; } catch (e) { users = []; }
  let priceCents = 1000;
  try {
    const settings = (await request("/admin/settings")).settings || {};
    if (Number(settings.priceCents) > 0) priceCents = Number(settings.priceCents);
  } catch (e) { /* usa o padrão */ }

  const roundOpts = rounds.map((r) => `<option value="${esc(r.id)}" ${String(r.id) === String(defaultRoundId) ? "selected" : ""}>Rodada ${esc(String(r.number))}${r.status ? ` — ${esc(r.status)}` : ""}</option>`).join("");
  const userOpts = users.map((u) => `<option value="${esc(String(u.id))}">${esc(u.username)}</option>`).join("");

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field"><label for="mt-round">Rodada</label><select class="input" id="mt-round">${roundOpts}</select></div>
    <div class="field"><label for="mt-user">Usuário (opcional)</label><select class="input" id="mt-user"><option value="">— Comprador sem conta —</option>${userOpts}</select></div>
    <div class="field"><label for="mt-name">Nome do titular</label><input class="input" id="mt-name" placeholder="Nome e sobrenome" /></div>
    <div class="field"><label for="mt-number">Nº do ticket (opcional)</label><input class="input" id="mt-number" type="number" min="1" placeholder="Automático" /></div>
    <p class="t-muted t-small">Preço: <b>${esc(brl(priceCents / 100))}</b> · vai direto ao financeiro como pago em mão.</p>
    <div class="divider"></div>
    <div class="card-header" style="padding:0 0 var(--space-3)"><h3 class="card-title"><i data-lucide="target"></i> Palpites do ticket</h3></div>
    <p class="t-muted t-small">Preencha o palpite de cada jogo habilitado da rodada, igual ao ticket normal.</p>
    <div data-picks-host></div>`;

  const userSel = body.querySelector("#mt-user");
  const nameEl = body.querySelector("#mt-name");
  const roundSel = body.querySelector("#mt-round");
  const picksHost = body.querySelector("[data-picks-host]");
  let picksReady = false;
  let picksRequest = 0;

  async function loadManualPicks(roundId) {
    const requestId = ++picksRequest;
    picksReady = false;
    picksHost.replaceChildren(stateNode("off", { title: "Palpites", message: "Carregando jogos da rodada…" }));
    if (window.lucide) window.lucide.createIcons({ nodes: [picksHost] });
    try {
      const data = await request(`/matches?round=${roundId}`);
      if (requestId !== picksRequest) return;
      const matches = (data.matches || []).filter((match) => match.enabled_for_tickets !== false);
      if (!matches.length) {
        picksHost.replaceChildren(stateNode("empty", { title: "Sem jogos", message: "Esta rodada não possui jogos habilitados." }));
        return;
      }
      picksHost.innerHTML = `<div class="table-wrap"><table class="table">
        <thead><tr><th>Jogo</th><th>Data</th><th>Mandante</th><th>Visitante</th></tr></thead>
        <tbody>${matches.map((m) => `<tr data-manual-pick="${esc(m.externalId)}">
          <td><strong>${esc(m.home || "Local")}</strong><span class="t-muted"> x </span><strong>${esc(m.away || "Visitante")}</strong></td>
          <td class="t-muted t-small">${esc(dateTime(m.date))}</td>
          <td><input class="input" type="number" inputmode="numeric" min="0" max="99" data-pick-side="home" aria-label="Palpite do mandante" placeholder="Gols"></td>
          <td><input class="input" type="number" inputmode="numeric" min="0" max="99" data-pick-side="away" aria-label="Palpite do visitante" placeholder="Gols"></td>
        </tr>`).join("")}</tbody>
      </table></div>`;
      picksHost.querySelectorAll("input[data-pick-side]").forEach((input) => {
        input.addEventListener("input", () => {
          if (input.value !== "" && !/^\d{1,2}$/.test(input.value)) input.setCustomValidity("Use um número entre 0 e 99.");
          else input.setCustomValidity("");
        });
      });
      picksReady = true;
    } catch (e) {
      if (requestId !== picksRequest) return;
      picksHost.replaceChildren(stateNode("error", { title: "Não foi possível carregar os jogos", message: e.message || "Tente novamente." }));
    }
  }

  roundSel.addEventListener("change", async () => { await loadManualPicks(roundSel.value); });
  await loadManualPicks(roundSel.value);

  if (userSel && nameEl) {
    userSel.addEventListener("change", () => {
      const u = users.find((x) => String(x.id) === userSel.value);
      if (u) nameEl.placeholder = u.username;
    });
  }

  const modal = openModal({
    title: "Cadastrar venda em mão",
    body,
    footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-save-manual>Salvar venda</button>`,
  });

  modal.overlay.querySelector("[data-close]").addEventListener("click", () => modal.close());
  modal.overlay.querySelector("[data-save-manual]").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    const roundId = body.querySelector("#mt-round").value;
    const userId = body.querySelector("#mt-user").value || null;
    const name = body.querySelector("#mt-name").value.trim();
    const rawNumber = body.querySelector("#mt-number").value.trim();
    if (!roundId) { toastError("Falta a rodada", "Escolha uma rodada."); btn.disabled = false; return; }
    if (!picksReady) { toastError("Palpites não carregados", "Aguarde os jogos da rodada ou tente novamente."); btn.disabled = false; return; }
    const rows = Array.from(picksHost.querySelectorAll("tr[data-manual-pick]"));
    const picks = rows.map((row) => ({
      matchId: Number(row.dataset.manualPick),
      home: row.querySelector("[data-pick-side='home']").value.trim(),
      away: row.querySelector("[data-pick-side='away']").value.trim(),
    }));
    const invalidPick = picks.find((pick) => !/^\d{1,2}$/.test(pick.home) || !/^\d{1,2}$/.test(pick.away));
    if (!rows.length || invalidPick) {
      toastError("Palpites incompletos", "Preencha os gols de todos os jogos usando números de 0 a 99.");
      btn.disabled = false;
      return;
    }
    try {
      const res = await request("/admin/tickets/manual", {
        method: "POST",
        body: {
          roundId,
          userId,
          name,
          number: rawNumber === "" ? null : Number(rawNumber),
          picks: picks.map((pick) => ({ ...pick, home: Number(pick.home), away: Number(pick.away) })),
        },
      });
      const t = (res && res.ticket) || {};
      toastSuccess("Venda registrada", `Ticket ${t.number || ""} de ${t.owner || name || "—"} (${brl((t.priceCents || priceCents) / 100)}).`);
      modal.close();
      if (onCreated) await onCreated(t);
    } catch (e) {
      toastError("Não foi possível salvar", e.message || "Tente novamente.");
    } finally {
      btn.disabled = false;
    }
  });
}