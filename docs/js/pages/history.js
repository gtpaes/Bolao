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
    // "Pontuados" saiu: o ticket nunca recebe o status "scored" (o fechamento já o
    // marca como "closed" antes de pontuar), então o filtro nunca casava. Os
    // tickets de rodada encerrada — com ou sem pontos — aparecem em "Encerrados".
    statusFilter.innerHTML = `<option value="all">Todos os status</option><option value="released">Em andamento</option><option value="closed">Encerrados</option>`;
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
  const total = Number(item.points) || 0;
  card.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Rodada ${esc(String(item.round_number || "—"))} · Ticket ${esc(String(item.ticket_number))}</h2>
      <span class="badge ${total > 0 ? "badge-green" : "badge-gray"}">${esc(String(total))} pontos</span>
    </div>
    <div class="card-body">
      <p class="t-muted">${esc(String(item.status))} · ${esc(dateShort(item.created_at))}</p>
      <div class="public-pick-list">${(item.picks || []).map(pickRow).join("")}</div>
    </div>`;
  return card;
}

// Cada palpite mostra o que foi apostado, o resultado real e os pontos. Jogo sem
// resultado ainda aparece como "aguardando" (o 0 ainda pode mudar) e o palpite
// que rendeu 0 ponto fica em vermelho, em vez de um selo cinza sem significado.
function pickRow(pick) {
  const points = Number(pick.points) || 0;
  const hasResult = Boolean(pick.actual);
  const predicted = pick.predicted ? `${pick.predicted.home} x ${pick.predicted.away}` : "—";
  const actual = hasResult ? ` · resultado ${pick.actual.home} x ${pick.actual.away}` : "";
  const badge = !hasResult
    ? '<span class="badge badge-gray">aguardando</span>'
    : (points > 0
      ? `<span class="badge badge-green">${esc(String(points))} pts</span>`
      : '<span class="badge badge-red">0 pts</span>');
  return `
    <div class="public-pick-row">
      <span>${esc(pick.home_team)} x ${esc(pick.away_team)}</span>
      <strong>${esc(predicted)}${esc(actual)}</strong>
      ${badge}
    </div>`;
}