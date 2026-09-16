/* js/pages/history.js — Histórico */
import { loadTemplate, run } from "./loader.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { dateShort } from "../../utils/format.js";
import { toastInfo } from "../../components/toast.js";

export async function render(view) {
  await loadTemplate(view, "history.html");
  await run(view, async () => {
    // Filtros
    view.querySelector("#f-round-data").innerHTML = `<option value="all">Todas as rodadas</option>`;
    view.querySelector("#f-status-data").innerHTML = `<option value="all">Todos os status</option>`;
    view.querySelector("#f-period-data").innerHTML = `<option value="all">Todo o período</option>`;

    const host = view.querySelector('[data-host="history"]');
    host.replaceChildren(stateNode("off", {
      title: "Sem histórico",
      message: "Nenhum registro encontrado.",
    }));

    view.querySelectorAll("[data-act='tab']").forEach((b) => b.addEventListener("click", () => toastInfo("Filtro", "Nenhum registro para exibir.")));
    ["f-round-data", "f-status-data", "f-period-data"].forEach((id) =>
      view.querySelector("#" + id).addEventListener("change", () => toastInfo("Filtro aplicado", "Nenhum registro para exibir.")));
  });
}