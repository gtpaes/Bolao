/* js/pages/history.js — Histórico */
import { loadTemplate, run } from "./loader.js";
import { listHistory } from "../api/history.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { dateShort } from "../../utils/format.js";

export async function render(view) {
  await loadTemplate(view, "history.html");
  await run(view, async () => {
    const host = view.querySelector('[data-host="history"]');
    const roundFilter = view.querySelector("#f-round-data");
    const statusFilter = view.querySelector("#f-status-data");
    const periodFilter = view.querySelector("#f-period-data");
    statusFilter.innerHTML = `<option value="all">Todos os status</option><option value="released">Em andamento</option><option value="closed">Encerrados</option><option value="scored">Pontuados</option>`;
    periodFilter.innerHTML = `<option value="all">Todo o período</option>`;

    const load = async () => {
      const data = await listHistory({ round: roundFilter.value, status: statusFilter.value });
      const history = data.history || [];
      const currentRound = roundFilter.value;
      const options = [...new Map(history.map((item) => [item.round_id, item])).values()];
      if (roundFilter.options.length <= 1) {
        roundFilter.innerHTML = `<option value="all">Todas as rodadas</option>${options.map((item) => `<option value="${esc(item.round_id)}">Rodada ${esc(String(item.round_number))}</option>`).join("")}`;
        roundFilter.value = currentRound;
      }
      if (!history.length) {
        host.replaceChildren(stateNode("off", { title: "Sem histórico", message: "Nenhum registro encontrado." }));
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "grid";
      wrap.replaceChildren(...history.map(historyCard));
      host.replaceChildren(wrap);
    };
    roundFilter.innerHTML = `<option value="all">Todas as rodadas</option>`;
    roundFilter.addEventListener("change", load);
    statusFilter.addEventListener("change", load);
    await load();
  });
}

function historyCard(item) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="card-header"><h2 class="card-title">Rodada ${esc(String(item.round_number || "—"))} · Ticket ${esc(String(item.ticket_number))}</h2><span class="badge badge-green">${esc(String(item.points))} pontos</span></div><div class="card-body"><p class="t-muted">${esc(String(item.status))} · ${esc(dateShort(item.created_at))}</p><div class="public-pick-list">${(item.picks || []).map((pick) => `<div class="public-pick-row"><span>${esc(pick.home_team)} x ${esc(pick.away_team)}</span><strong>${esc(String(pick.predicted.home))} x ${esc(String(pick.predicted.away))}${pick.actual ? ` · resultado ${esc(String(pick.actual.home))} x ${esc(String(pick.actual.away))}` : ""}</strong><span class="badge badge-gray">${esc(String(pick.points))} pts</span></div>`).join("")}</div></div>`;
  return card;
}