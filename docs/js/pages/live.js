/* js/pages/live.js — Jogos ao Vivo */
import { loadTemplate, run } from "./loader.js";
import { listLive } from "../api/matches.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { dateTime } from "../../utils/format.js";
import { matchCardSmall } from "./dashboard.js";

export async function render(view) {
  await loadTemplate(view, "live.html");
  await run(view, async () => {
    const host = view.querySelector('[data-host="live-matches"]');
    let matches = null;
    try { matches = (await listLive()).matches || []; } catch (e) { matches = null; }

    if (matches === null) {
      host.replaceChildren(stateNode("off", { title: "Jogos ao vivo não disponíveis", message: "Os placares em tempo real aparecerão aqui." }));
      return;
    }
    if (!matches.length) {
      host.replaceChildren(stateNode("empty", { title: "Sem jogos ao vivo agora", message: "Não há jogos em disputa neste momento." }));
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "grid";
    wrap.replaceChildren(...matches.map(matchCardSmall));
    host.replaceChildren(wrap);
  });
}