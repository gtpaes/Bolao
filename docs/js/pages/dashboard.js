/* js/pages/dashboard.js — Dashboard do usuário */
import { loadTemplate, run } from "./loader.js";
import { getCurrentRound } from "../api/rounds.js";
import { listMatches, listLive } from "../api/matches.js";
import { listTickets } from "../api/tickets.js";
import { stateNode, loadingNode } from "../../utils/states.js";
import { currentProfile } from "../api/auth.js";

export async function render(view) {
  await loadTemplate(view, "dashboard.html");
  await run(view, async () => {
    const profile = currentProfile() || {};
    const host = (id) => view.querySelector('[data-host="' + id + '"]');
    const setHost = (id, nodeHtml) => { const h = host(id); if (h) h.replaceChildren(nodeHtml); };

    // Hero
    let round;
    try { round = (await getCurrentRound()).round; } catch (e) { round = null; }
    const heroName = profile.username || "Participante";
    const hasRound = !!round;
    const hero = document.createElement("div");
    hero.innerHTML = `
      <div class="hero" style="padding:var(--space-6)">
        <div style="display:flex;gap:var(--space-4);align-items:center;flex-wrap:wrap">
          <div style="flex:1 1 200px;min-width:0">
            <span class="badge badge-green">Futebol</span>
            <h1 style="margin-top:var(--space-3)">Olá, ${heroName}</h1>
            <p>${hasRound ? ('Rodada ' + round.number + ' — faça seus palpites antes do fechamento.') : 'Nenhuma rodada aberta no momento. Compre seus tickets e prepare-se para a próxima rodada.'}</p>
            <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);flex-wrap:wrap">
              <a class="btn btn-primary" href="#/picks">Fazer palpites</a>
              <a class="btn btn-outline" href="#/buy">Comprar tickets</a>
            </div>
          </div>
          <div class="mini-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
      </div>`;
    setHost("hero", hero);

    // Estatísticas: rodada, tickets, pontos e posição
    let tickets = [];
    try { tickets = (await listTickets()).tickets || []; } catch (e) { tickets = []; }

    const statDefs = [
      { ico: "calendar-clock", label: "Rodada atual", value: hasRound ? `Rodada ${round.number}` : "—", sub: hasRound ? round.status : "Sem rodada" },
      { ico: "ticket", label: "Meus tickets", value: String(tickets.length), sub: "nesta rodada" },
      { ico: "target", label: "Minha pontuação", value: "—", sub: "sem dados" },
      { ico: "list-ordered", label: "Minha posição", value: "—", sub: "sem dados" },
    ];
    const grid = view.querySelector("#stats-grid");
    grid.replaceChildren(...statDefs.map((s) => statCard(s)));

    // Rodada: jogos
    const matchesHost = host("round-matches");
    let mtch = null;
    try { mtch = (await listMatches(round && round.id)).matches || []; } catch (e) { mtch = null; }
    if (mtch && mtch.length) matchesHost.replaceChildren(...mtch.map(matchCardSmall));
    else if (mtch === null) matchesHost.replaceChildren(stateNode("off", { title: "Jogos ainda não disponíveis", message: "Os jogos da rodada aparecerão aqui quando estiverem disponíveis." }));
    else matchesHost.replaceChildren(stateNode("empty", { title: "Sem jogos nesta rodada", message: "Quando a rodada estiver configurada, verá os jogos aqui." }));

    // Ao vivo
    const liveHost = host("live");
    let lv = null;
    try { lv = (await listLive()).matches || []; } catch (e) { lv = null; }
    if (lv === null) liveHost.replaceChildren(stateNode("off", { title: "Jogos ao vivo não disponíveis", message: "Os placares ao vivo aparecerão aqui quando estiverem disponíveis." }));
    else if (!lv.length) liveHost.replaceChildren(stateNode("empty", { title: "Nenhum jogo ao vivo agora", message: "Não há jogos em disputa neste momento." }));
    else liveHost.replaceChildren(...lv.map(matchCardSmall));
  });
}

function statCard(s) {
  const c = document.createElement("div");
  c.className = "card";
  c.innerHTML = `
    <div class="stat">
      <span class="ico-wrap"><i data-lucide="${s.ico}"></i></span>
      <span class="stat-value">${esc(s.value)}</span>
      <span class="stat-label">${esc(s.label)}</span>
      <span class="t-xs t-muted">${esc(s.sub)}</span>
    </div>`;
  return c;
}

const STATUS_LABEL = { live: "Ao vivo", finished: "Encerrado", scheduled: "Agendado", postponed: "Adiado", cancelled: "Cancelado" };

export function matchCardSmall(m) {
  const c = document.createElement("div");
  c.className = "card match card-pad-sm";
  // Placar aparece ao vivo E em jogo encerrado; "vs" só em jogo sem placar.
  const hasScore = (m.status === "live" || m.status === "finished") && (m.home_score != null || m.away_score != null);
  const topLabel = m.live ? '<span class="live-inline"><span class="dot"></span>Ao vivo</span>' : esc(STATUS_LABEL[m.status] || m.status || "");
  c.innerHTML = `
    <div class="match-top">
      <span>${esc(m.date ? `${dateShort(m.date)} · ${time(m.date)}` : "Em breve")}</span>
      ${topLabel}
    </div>
    <div class="match-teams">
      <div class="match-team">${crest(m.home_crest)}<span class="match-name">${esc(m.home || "Equipe A")}</span></div>
      <div class="match-center">${hasScore ? `<div class="match-score"><span class="score-box">${esc(m.home_score ?? "–")}</span><span class="score-box">${esc(m.away_score ?? "–")}</span></div>` : '<span class="t-muted">vs</span>'}</div>
      <div class="match-team">${crest(m.away_crest)}<span class="match-name">${esc(m.away || "Equipe B")}</span></div>
    </div>`;
  return c;
}

function crest(src) {
  if (src) return `<span class="match-crest"><img src="${esc(src)}" alt="" /></span>`;
  return `<span class="match-crest"><span class="match-crest-placeholder"><i data-lucide="volleyball"></i></span></span>`;
}

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
import { dateShort, time } from "../../utils/format.js";