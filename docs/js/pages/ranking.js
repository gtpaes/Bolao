/* js/pages/ranking.js — Ranking */
import { loadTemplate, run } from "./loader.js";
import { getRanking } from "../api/ranking.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { currentProfile } from "../api/auth.js";

export async function render(view) {
  await loadTemplate(view, "ranking.html");
  await run(view, async () => {
    const profile = currentProfile() || {};
    let data = { ranking: [], myPosition: null };
    try { data = await getRanking(); } catch (e) { data = { ranking: null, myPosition: null }; }

    const myHost = view.querySelector('[data-host="my-position"]');
    if (data.myPosition == null || data.ranking === null) {
            if (myHost) myHost.replaceChildren(stateNode("off", { title: "Minha posição", message: "Sem dados no momento." }));
    } else {
            if (myHost) myHost.innerHTML = `<div class="row"><span class="pos-pill pos-me">${esc(String(data.myPosition))}</span><span class="t-soft">Sua posição atual</span></div>`;
    }

        const body = view.querySelector("#ranking-body");
    if (!body) return;
    if (!data.ranking || !data.ranking.length) {
      body.innerHTML = `<tr><td colspan="4">${emptyRow()}</td></tr>`;
      return;
    }
    body.innerHTML = data.ranking.map((r, i) => {
      const me = profile.id && r.user_id === profile.id;
      return `<tr class="${me ? "row-me" : ""}">
        <td><span class="pos-pill ${posClass(i + 1, me)}">${i + 1}</span></td>
        <td class="row"><span class="avatar avatar-sm">${esc(initials(r.username))}</span> ${me ? `<span class="t-bold">${esc(r.username)} (você)</span>` : esc(r.username)}</td>
        <td><span class="num">${esc(String(r.points ?? 0))}</span></td>
        <td><span class="num">${esc(String(r.tickets ?? 0))}</span></td>
      </tr>`;
    }).join("");
    if (typeof window.lucide !== "undefined") window.lucide.createIcons();
  });
}

function emptyRow() {
  return `<div class="state" style="padding:var(--space-7)"><span class="state-ico muted"><i data-lucide="list-ordered"></i></span><h3>Ranking vazio</h3><p>As posições aparecerão aqui.</p></div>`;
}
function posClass(pos, me) { return (pos === 1 ? "pos-1" : pos === 2 ? "pos-2" : pos === 3 ? "pos-3" : "") + (me ? " pos-me" : ""); }
function initials(n) {
  if (!n) return "?";
  const p = String(n).trim().split(/\s+/).filter(Boolean);
  return p.length < 2 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}