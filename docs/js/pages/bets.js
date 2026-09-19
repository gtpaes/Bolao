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
  card.innerHTML = `
    <div class="card-header">
      <div class="row"><span class="avatar avatar-sm">${esc(initials(ticket.username))}</span><h2 class="card-title">${esc(ticket.username)}</h2></div>
      <span class="badge badge-gray">Ticket ${esc(String(ticket.ticket_number))}</span>
    </div>
    <div class="card-body">
      <div class="public-pick-list">
        ${(ticket.picks || []).map((pick) => `
          <div class="public-pick-row">
            <span>${esc(pick.home_team || "Mandante")} x ${esc(pick.away_team || "Visitante")}</span>
            <strong>${esc(String(pick.home))} x ${esc(String(pick.away))}</strong>
            ${Number(pick.points) > 0 ? `<span class="badge badge-green">${esc(String(pick.points))} pts</span>` : ""}
          </div>`).join("")}
      </div>
    </div>
    <div class="card-footer"><span class="t-muted">Total: <strong>${esc(String(ticket.points || 0))} pontos</strong></span></div>`;
  return card;
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}
