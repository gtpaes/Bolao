/* js/pages/round.js — Rodada (usuário) */
import { loadTemplate, run } from "./loader.js";
import { getCurrentRound } from "../api/rounds.js";
import { listMatches } from "../api/matches.js";
import { stateNode } from "../../utils/states.js";
import { countdown } from "../../components/countdown.js";
import { dateShort, time } from "../../utils/format.js";
import { matchCardSmall } from "./dashboard.js";

export async function render(view) {
  await loadTemplate(view, "round.html");
  await run(view, async () => {
        const subHost = view.querySelector('[data-host="sub"]');
    if (subHost) subHost.textContent = "Informação da rodada atual, prazo e jogos.";

    let round = null;
    try { round = (await getCurrentRound()).round; } catch (e) { /* noop */ }

    const sumHost = view.querySelector('[data-host="round-summary"]');
    if (round) {
      const closed = isClosed(round);
      const badge = closed ? '<span class="badge badge-gray">Palpites encerrados</span>' : '<span class="badge badge-green">Palpites abertos</span>';
      const card = document.createElement("div");
      card.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3)">
            <div><h2 style="font-size:1.3rem">Rodada ${esc(round.number || "?")}</h2>
              <span class="t-muted t-small">${round.date ? dateShort(round.date) : "Data a definir"}</span></div>
            ${badge}
          </div>
          <div class="divider"></div>
          ${closed ? `<p class="t-muted">Os palpites desta rodada foram encerrados.</p>` : `
            <p class="t-ttl" style="margin-bottom:var(--space-3)">Data limite para palpites</p>
            <div id="round-countdown"></div>`}
        </div>`;
            if (sumHost) sumHost.replaceChildren(card);
      if (!closed) {
        const cdHost = card.querySelector("#round-countdown");
        const cd = countdown(round.deadline, "Encerrado");
        cdHost.appendChild(cd.node);
      }
    } else {
            if (sumHost) sumHost.replaceChildren(stateNode("off", {
        title: "Nenhuma rodada aberta",
        message: "A rodada atual será configurada pelo administrador. Quando estiver aberta, aqui você verá os jogos e o prazo.",
      }));
    }

    // Jogos
    const mHost = view.querySelector('[data-host="matches"]');
    let matches = null;
    try { matches = (await listMatches(round && round.id)).matches || []; } catch (e) { matches = null; }
    if (matches && matches.length) {
      const wrap = document.createElement("div");
      wrap.className = "grid";
      wrap.replaceChildren(...matches.map(matchCardSmall));
            if (mHost) mHost.replaceChildren(wrap);
    } else if (matches === null) {
            if (mHost) mHost.replaceChildren(stateNode("error", { title: "Não foi possível carregar os jogos", message: "Ocorreu um erro ao buscar os jogos. Tente novamente." }));
    } else {
            if (mHost) mHost.replaceChildren(stateNode("empty", { title: "Nenhum jogo nesta rodada", message: "Os jogos aparecerão quando a rodada for configurada." }));
    }

    // Regras de pontuação
    const rulesHost = view.querySelector('[data-host="rules"]');
        if (rulesHost) rulesHost.innerHTML = `
      <div class="card" id="scoring" style="margin-top:var(--space-5)">
        <div class="card-header"><h2 class="card-title"><i data-lucide="target"></i> Regras de pontuação</h2></div>
        <div class="card-body">
          <p class="t-muted t-small" style="margin-bottom:var(--space-4)">Confira abaixo quanto vale cada acerto.</p>
          <div class="scoring-grid">
            <div class="scoring-item"><span class="si-label">Placar exato</span><span class="si-pts">10 pontos</span></div>
            <div class="scoring-item"><span class="si-label">Empate correto</span><span class="si-pts">6 pontos</span></div>
            <div class="scoring-item"><span class="si-label">Vencedor correto (sem acertar o placar)</span><span class="si-pts">4 pontos</span></div>
            <div class="scoring-item"><span class="si-label">Erro</span><span class="si-pts">0 pontos</span></div>
          </div>
        </div>
      </div>`;
  });
}

function isClosed(round) {
  if (!round || !round.deadline) return false;
  return new Date(round.deadline).getTime() <= Date.now();
}
function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}