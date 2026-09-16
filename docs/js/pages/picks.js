/* js/pages/picks.js — Fazer Palpites (usuário) */
import { loadTemplate, run } from "./loader.js";
import { getCurrentRound } from "../api/rounds.js";
import { listMatches } from "../api/matches.js";
import { listTickets, savePicks } from "../api/tickets.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { dateTime, ticketCode } from "../../utils/format.js";
import { toastSuccess, toastError } from "../../components/toast.js";

export async function render(view) {
  await loadTemplate(view, "picks.html");
  await run(view, async () => {
    let round = null;
    try { round = (await getCurrentRound()).round; } catch (e) { /* noop */ }
    let tickets = [];
    try { tickets = (await listTickets()).tickets || []; } catch (e) { tickets = []; }

    const closed = round && round.deadline && new Date(round.deadline).getTime() <= Date.now();
    view.querySelector('[data-host="status-chip"]').innerHTML =
      closed ? '<span class="badge badge-gray">Encerrados</span>' : '<span class="badge badge-green">Abertos</span>';

    const pickerHost = view.querySelector('[data-host="ticket-picker"]');
    if (!tickets.length) {
      pickerHost.replaceChildren(stateNode("empty", { title: "Você precisa de um ticket", message: "Compre ao menos um ticket para fazer seus palpites." }));
      pickerHost.insertAdjacentHTML("afterend", `<div class="state" style="padding:var(--space-5)"><a class="btn btn-primary btn-lg" href="#/buy">Comprar tickets</a></div>`);
      return;
    }

    const activeTicket = tickets[0];
    let selectedTicket = activeTicket;
    const picker = document.createElement("div");
    picker.innerHTML = `
      <div class="card-header"><h2 class="card-title"><i data-lucide="ticket"></i> Ticket de palpites</h2></div>
      <div class="card-body">
        <div class="row wrap" style="gap:var(--space-2)">${tickets.map((t) => `<button class="tab ${t.id === activeTicket.id ? "active" : ""}" data-ticket="${esc(t.id)}">${ticketCode(t.number)}</button>`).join("")}</div>
        <p class="t-muted t-small" style="margin-top:var(--space-3)">Cada ticket guarda seus próprios palpites.</p>
      </div>`;
    pickerHost.replaceChildren(picker);

    const formHost = view.querySelector('[data-host="picks-form"]');
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
          <button class="btn btn-primary btn-lg btn-block" id="save-picks" ${closed ? "disabled" : ""}><i data-lucide="save"></i> Salvar palpites</button>
        </div>
      </div>`;
    formHost.replaceChildren(form);
    form.querySelector("#picks-matches").replaceChildren(...matches.map((m, idx) => pickRow(m, closed, idx)));

    picker.querySelectorAll("[data-ticket]").forEach((btn) =>
      btn.addEventListener("click", () => {
        picker.querySelectorAll("[data-ticket]").forEach((b) => b.classList.toggle("active", b === btn));
        selectedTicket = tickets.find((t) => t.id === btn.dataset.ticket) || selectedTicket;
        toastSuccess("Ticket selecionado", `Palpitando com ${btn.textContent}`);
      }));

    const saveBtn = form.querySelector("#save-picks");
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