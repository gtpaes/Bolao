/* js/pages/bets.js — Apostas públicas da rodada. */
import { loadTemplate, run } from "./loader.js";
import { listPublicPicks, getPublicTicket } from "../api/picks.js";
import { stateNode } from "../../utils/states.js";
import { esc, hydrateIcons } from "../../utils/dom.js";

export async function render(view) {
  await loadTemplate(view, "bets.html");
  await run(view, async () => {
    const host = view.querySelector('[data-host="public-picks"]');
    const roundLabel = view.querySelector('[data-host="round-label"]');
    if (!host || !roundLabel) throw new Error("A estrutura da página de apostas não carregou corretamente.");

    let data;
    try {
      const hashPath = (window.location.hash || "").replace(/^#\/?/, "").split("/");
      const ticketId = hashPath[0] === "bets" && hashPath[1] ? decodeURIComponent(hashPath[1]) : null;
      data = ticketId ? await getPublicTicket(ticketId) : await listPublicPicks();
    } catch (error) {
      host.replaceChildren(stateNode("error", { title: "Não foi possível carregar as apostas", message: error.message || "Tente novamente." }));
      return;
    }

    if (data.visible === false) {
      host.replaceChildren(stateNode("off", { title: "Apostas protegidas", message: "Os palpites de todos os jogadores serão exibidos quando a rodada for encerrada." }));
      return;
    }
    if (!data.round || !data.tickets || !data.tickets.length) {
      host.replaceChildren(stateNode("empty", { title: "Nenhuma aposta registrada", message: "Os palpites aparecerão aqui depois que os jogadores enviarem suas apostas." }));
      return;
    }

    roundLabel.textContent = `Rodada ${data.round.number}`;
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.replaceChildren(...data.tickets.map(ticketCard));
    host.replaceChildren(grid);
    hydrateIcons(host);
  });
}

function ticketCard(ticket) {
  const card = document.createElement("div");
  card.className = "card";
  const picks = ticket.picks || [];
  const scored = Number.isInteger(ticket.scored_count) ? ticket.scored_count : picks.filter((pick) => pick.finished === true).length;
  card.innerHTML = `
    <div class="card-header">
      <div class="row"><span class="avatar avatar-sm">${esc(initials(ticket.username))}</span><h2 class="card-title">${esc(ticket.username)}</h2></div>
      <span class="badge badge-gray">Ticket ${esc(String(ticket.ticket_number))}</span>
    </div>
    <div class="card-body">
      <div class="public-pick-list">
        ${picks.map(pickRow).join("")}
      </div>
    </div>
    <div class="card-footer"><span class="t-muted">Total: <strong>${esc(String(ticket.points || 0))} pontos</strong> · ${esc(String(scored))} de ${esc(String(picks.length))} jogos com resultado</span></div>`;
  return card;
}

// Cada linha responde às três perguntas do jogador: qual era o jogo, o que ele
// apostou, qual foi o resultado e quanto rendeu. Quem não pontuou aparece como
// "0 pts" em vermelho — antes o selo simplesmente sumia e o jogo parecia não
// ter sido computado.
function pickRow(pick) {
  const points = Number(pick.points) || 0;
  const finished = pick.finished === true;
  const result = finished
    ? `<strong>${esc(String(pick.home_score))} x ${esc(String(pick.away_score))}</strong>`
    : '<strong>—</strong>';
  const badge = finished
    ? (points > 0
      ? `<span class="badge badge-green">${esc(String(points))} pts</span>`
      : '<span class="badge badge-red">0 pts</span>')
    : (pick.match_status === "live"
      ? '<span class="badge badge-amber">ao vivo</span>'
      : '<span class="badge badge-gray">aguardando</span>');
  return `
    <div class="public-pick-row rich">
      <span class="pp-match">${esc(pick.home_team || "Mandante")} x ${esc(pick.away_team || "Visitante")}</span>
      <span class="pp-field"><span class="pp-label">Palpite</span><strong>${esc(String(pick.home))} x ${esc(String(pick.away))}</strong></span>
      <span class="pp-field${finished ? "" : " t-muted"}"><span class="pp-label">Resultado</span>${result}</span>
      ${badge}
    </div>`;
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}
