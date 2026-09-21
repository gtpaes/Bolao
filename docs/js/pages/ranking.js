/* js/pages/ranking.js — Ranking (rodada atual + rodada anterior) */
import { loadTemplate, run } from "./loader.js";
import { getRanking } from "../api/ranking.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { currentProfile } from "../api/auth.js";

export async function render(view) {
  await loadTemplate(view, "ranking.html");
  await run(view, async () => {
    const profile = currentProfile() || {};
    let data = { ranking: [], myPosition: null, previous: null, round: null };
    try { data = await getRanking(); } catch (e) { data = { ranking: null, myPosition: null, previous: null, round: null }; }

    const myHost = view.querySelector('[data-host="my-position"]');
    if (data.myPosition == null || data.ranking === null) {
      if (myHost) myHost.replaceChildren(stateNode("off", { title: "Minha posição", message: "Sem dados no momento." }));
    } else {
      if (myHost) myHost.innerHTML = `<div class="row"><span class="pos-pill pos-me">${esc(String(data.myPosition))}</span><span class="t-soft">Sua posição atual</span></div>`;
    }

    const label = view.querySelector('[data-host="current-round-label"]');
    if (label) label.textContent = data.round ? `Rodada ${data.round.number}` : "Rodada atual";

    const body = view.querySelector("#ranking-body");
    if (!body) return;
    if (!data.ranking || !data.ranking.length) {
      body.innerHTML = `<tr><td colspan="4">${emptyRow("Ranking vazio", "As posições aparecerão aqui.")}</td></tr>`;
    } else {
      body.innerHTML = rankingRows(data.ranking, profile);
      wireRows(body);
    }

    // Segunda seção: a rodada anterior. Só aparece quando existe e tem dados.
    const prevCard = view.querySelector("#previous-round-card");
    const prevBody = view.querySelector("#previous-ranking-body");
    if (!prevCard || !prevBody) return;
    const previous = data.previous || null;
    if (!previous || !previous.round) { prevCard.hidden = true; return; }

    prevCard.hidden = false;
    const prevLabel = view.querySelector('[data-host="previous-round-label"]');
    const prevMine = view.querySelector('[data-host="previous-my-position"]');
    if (prevLabel) prevLabel.textContent = `Rodada ${previous.round.number}`;
    if (prevMine) prevMine.textContent = previous.myPosition ? `Sua posição: ${previous.myPosition}º` : "";
    if (!previous.ranking || !previous.ranking.length) {
      prevBody.innerHTML = `<tr><td colspan="4">${emptyRow("Sem apostas nesta rodada", "Ninguém pontuou na rodada anterior.")}</td></tr>`;
    } else {
      prevBody.innerHTML = rankingRows(previous.ranking, profile);
      wireRows(prevBody);
    }
    if (typeof window.lucide !== "undefined") window.lucide.createIcons();
  });
}

// As duas tabelas usam as mesmas colunas e o mesmo destaque do próprio usuário.
function rankingRows(rows, profile) {
  return rows.map((r, i) => {
    const pos = Number(r.position) || i + 1;
    const me = profile.id && r.user_id === profile.id;
    return `<tr class="${me ? "row-me" : ""} ranking-link" data-ticket="${esc(r.ticket_id)}" tabindex="0" role="link">
        <td><span class="pos-pill ${posClass(pos, me)}">${pos}</span></td>
        <td class="row"><span class="avatar avatar-sm">${esc(initials(r.username))}</span> ${me ? `<span class="t-bold">${esc(r.username)} (você)</span>` : esc(r.username)}</td>
        <td class="col-ticket">Ticket ${esc(String(r.ticket_number))}</td>
        <td><span class="num">${esc(String(r.points ?? 0))}</span></td>
      </tr>`;
  }).join("");
}

// Clicar/teclar abre os palpites daquele ticket (igual nas duas tabelas).
function wireRows(scope) {
  scope.querySelectorAll("[data-ticket]").forEach((row) => {
    const open = () => { window.location.hash = `#/bets/${encodeURIComponent(row.dataset.ticket)}`; };
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  });
}

function emptyRow(title, message) {
  return `<div class="state" style="padding:var(--space-7)"><span class="state-ico muted"><i data-lucide="list-ordered"></i></span><h3>${esc(title)}</h3><p>${esc(message)}</p></div>`;
}
function posClass(pos, me) { return (pos === 1 ? "pos-1" : pos === 2 ? "pos-2" : pos === 3 ? "pos-3" : "") + (me ? " pos-me" : ""); }
function initials(n) {
  if (!n) return "?";
  const p = String(n).trim().split(/\s+/).filter(Boolean);
  return p.length < 2 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}