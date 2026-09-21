/* js/pages/picks.js — Fazer Palpites (usuário) */
import { loadTemplate, run } from "./loader.js";
import { getCurrentRound, isRoundClosed } from "../api/rounds.js";
import { listMatches } from "../api/matches.js";
import { listTickets, getTicket, savePicks } from "../api/tickets.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { dateTime, ticketCode } from "../../utils/format.js";
import { toastSuccess, toastError } from "../../components/toast.js";

export async function render(view) {
  await loadTemplate(view, "picks.html");
  await run(view, async () => {
    const statusChip = view.querySelector('[data-host="status-chip"]');
    const pickerHost = view.querySelector('[data-host="ticket-picker"]');
    const formHost = view.querySelector('[data-host="picks-form"]');

    if (!statusChip || !pickerHost || !formHost) {
      throw new Error("A estrutura da página de palpites não carregou corretamente.");
    }

    let round = null;
    try { round = (await getCurrentRound()).round; } catch (e) { /* noop */ }
    let tickets = [];
    try {
      const data = await listTickets();
      tickets = data.tickets || [];
      // O servidor já devolve só a rodada corrente; o filtro protege a tela se a
      // rodada mudar entre as duas chamadas (ticket antigo não serve para palpitar).
      if (data.round && data.round.id && round && round.id && data.round.id !== round.id) tickets = [];
    } catch (e) { tickets = []; }

    // A trava vem resolvida do servidor (can_pick), incluindo a regra "1º jogo − 2h";
    // antes a tela mostrava "Abertos" com a rodada já encerrada.
    const closed = isRoundClosed(round);
    statusChip.innerHTML =
      closed ? '<span class="badge badge-gray">Encerrados</span>' : '<span class="badge badge-green">Abertos</span>';

    if (!tickets.length) {
      // Sem ticket DESTA rodada: nada de oferecer o ticket da rodada anterior.
      const title = closed ? "Rodada encerrada" : "Você precisa de um ticket nesta rodada";
      const message = closed
        ? "Os palpites desta rodada estão encerrados. Seus tickets e a pontuação ficam no histórico."
        : "Cada ticket vale para uma rodada: compre um ticket desta rodada para palpitar.";
      pickerHost.replaceChildren(stateNode("empty", { title, message }));
      pickerHost.insertAdjacentHTML("afterend", `<div class="state" style="padding:var(--space-5)"><a class="btn btn-primary btn-lg" href="#/buy">Comprar tickets</a> <a class="btn btn-ghost btn-lg" href="#/history">Ver histórico</a></div>`);
      return;
    }

    const activeTicket = tickets.find((t) => t.status === "released") || tickets[0];
    let selectedTicket = activeTicket;
    const picker = document.createElement("div");
    picker.innerHTML = `
      <div class="card-header"><h2 class="card-title"><i data-lucide="ticket"></i> Ticket de palpites</h2></div>
      <div class="card-body">
        <div class="row wrap" style="gap:var(--space-2)">${tickets.map((t) => `<button class="tab ${t.id === activeTicket.id ? "active" : ""}" data-ticket="${esc(t.id)}">${ticketCode(t.number)}</button>`).join("")}</div>
        <p class="t-muted t-small" style="margin-top:var(--space-3)">Cada ticket guarda seus próprios palpites.</p>
      </div>`;
    pickerHost.replaceChildren(picker);

    let matches = null;
    try { matches = (await listMatches(round && round.id)).matches || []; } catch (e) { matches = null; }
    if (matches === null) { formHost.replaceChildren(stateNode("error", { title: "Não foi possível carregar os jogos", message: "Ocorreu um erro ao buscar os jogos. Tente novamente." })); return; }
    if (!matches.length) { formHost.replaceChildren(stateNode("empty", { title: "Sem jogos na rodada", message: "Os jogos aparecerão quando a rodada for configurada." })); return; }

    const form = document.createElement("div");
    form.innerHTML = `
      <div class="card">
        <div class="card-header"><h2 class="card-title"><i data-lucide="target"></i> Placares da rodada</h2></div>
        <div id="picks-matches"></div>
        <div class="card-footer">
          <button class="btn btn-primary btn-lg btn-block" id="save-picks" ${closed || activeTicket.status !== "released" ? "disabled" : ""}><i data-lucide="save"></i> Salvar palpites</button>
        </div>
      </div>`;
    formHost.replaceChildren(form);
    const matchesHost = form.querySelector("#picks-matches");
    const saveBtn = form.querySelector("#save-picks");

    const loadTicketPicks = async (ticket) => {
      saveBtn.disabled = true;
      matchesHost.replaceChildren(...matches.map((m, idx) => pickRow(m, closed || ticket.status !== "released", idx)));
      try {
        const data = await getTicket(ticket.id);
        const picksByMatch = new Map((data.ticket && data.ticket.picks || []).map((pick) => [String(pick.matchExternalId), pick]));
        matchesHost.querySelectorAll(".pick-row").forEach((row) => {
          const pick = picksByMatch.get(String(row.dataset.matchId));
          if (!pick) return;
          const home = row.querySelector("[data-side='home']");
          const away = row.querySelector("[data-side='away']");
          if (home) home.value = pick.home;
          if (away) away.value = pick.away;
        });
        saveBtn.disabled = closed || ticket.status !== "released";
      } catch (error) {
        matchesHost.replaceChildren(stateNode("error", { title: "Não foi possível carregar este ticket", message: error.message || "Tente novamente." }));
      }
    };

    await loadTicketPicks(activeTicket);

    picker.querySelectorAll("[data-ticket]").forEach((btn) =>
      btn.addEventListener("click", () => {
        picker.querySelectorAll("[data-ticket]").forEach((b) => b.classList.toggle("active", b === btn));
        selectedTicket = tickets.find((t) => t.id === btn.dataset.ticket) || selectedTicket;
        loadTicketPicks(selectedTicket);
        toastSuccess("Ticket selecionado", `Palpitando com ${btn.textContent}`);
      }));

    saveBtn.addEventListener("click", async () => {
      const picks = Array.from(form.querySelectorAll(".pick-row")).map((row) => ({
        matchId: row.dataset.matchId,
        home: Number(row.querySelector("[data-side='home']").value || 0),
        away: Number(row.querySelector("[data-side='away']").value || 0),
      }));
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="spinner in-btn"></span> Salvando…`;
      try {
        await savePicks(selectedTicket.id, picks);
        toastSuccess("Palpites salvos", "Seus palpites foram registrados.");
        saveBtn.innerHTML = `<i data-lucide="check"></i> Salvo`;
      } catch (e) {
        toastError("Não foi possível salvar", e.message || "Tente novamente.");
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i data-lucide="save"></i> Salvar palpites`;
      }
    });
  });
}

function pickRow(m, closed, idx) {
  const row = document.createElement("div");
  row.className = "card match card-pad-sm pick-row";
  row.dataset.matchId = m.id || String(idx);
  row.innerHTML = `
    <div class="match-top"><span>${esc(dateTime(m.date))}</span>${m.live ? '<span class="live-inline"><span class="dot"></span>Ao vivo</span>' : ""}</div>
    <div class="pick-group">
      <div class="pick-team"><span class="match-crest">${crest(m.home_crest)}</span><span>${esc(m.home || "Local")}</span></div>
      <div class="pick-scores">
        <input class="pick-score" inputmode="numeric" maxlength="2" aria-label="Gols do time local" data-side="home" ${closed ? "disabled" : ""} />
        <span class="pick-x">x</span>
        <input class="pick-score" inputmode="numeric" maxlength="2" aria-label="Gols do time visitante" data-side="away" ${closed ? "disabled" : ""} />
      </div>
      <div class="pick-team"><span class="match-crest">${crest(m.away_crest)}</span><span>${esc(m.away || "Visitante")}</span></div>
    </div>`;
  return row;
}

function crest(src) {
  if (src) return `<span class="match-crest"><img src="${esc(src)}" alt=""></span>`;
  return `<span class="match-crest"><span class="match-crest-placeholder"><i data-lucide="volleyball"></i></span></span>`;
}