/* js/pages/tickets.js — Meus Tickets */
import { loadTemplate, run } from "./loader.js";
import { listTickets } from "../api/tickets.js";
import { stateNode } from "../../utils/states.js";
import { esc } from "../../utils/dom.js";
import { dateShort, ticketCode, brl } from "../../utils/format.js";

const STATUS_BADGE = {
  waiting_payment: ["badge-amber", "Aguardando pagamento"],
  paid: ["badge-blue", "Pago"],
  released: ["badge-green", "Liberado"],
  active: ["badge-green", "Em andamento"],
  finished: ["badge-gray", "Finalizado"],
};

export async function render(view) {
  await loadTemplate(view, "tickets.html");
  await run(view, async () => {
    const tabs = view.querySelector("#ticket-tabs");
    const statuses = [
      ["all", "Todos"],
      ["active", "Ativos"],
      ["released", "Liberados"],
      ["waiting_payment", "Por pagar"],
      ["finished", "Finalizados"],
    ];
    tabs.innerHTML = statuses.map(([k, l]) => `<button class="tab ${k === "all" ? "active" : ""}" data-s="${k}">${l}</button>`).join("");

    let tickets = [];
    try { tickets = (await listTickets()).tickets || []; } catch (e) { tickets = []; }
    const listHost = view.querySelector('[data-host="tickets"]');

    if (!tickets.length) {
      listHost.replaceChildren(stateNode("empty", { title: "Você ainda não tem tickets", message: "Compre um ticket para começar a participar na rodada." }));
      listHost.insertAdjacentHTML("afterend", `<div class="state" style="padding:var(--space-5)"><a class="btn btn-primary btn-lg" href="#/buy">Comprar tickets</a></div>`);
      return;
    }

    const renderList = (filter) => {
      const list = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
      if (!list.length) { listHost.replaceChildren(stateNode("empty", { title: "Sem tickets neste status", message: "" })); return; }
      const wrap = document.createElement("div");
      wrap.className = "grid";
      wrap.replaceChildren(...list.map(ticketCard));
      listHost.replaceChildren(wrap);
    };

    tabs.querySelectorAll("[data-s]").forEach((btn) => btn.addEventListener("click", () => {
      tabs.querySelectorAll("[data-s]").forEach((b) => b.classList.toggle("active", b === btn));
      renderList(btn.dataset.s);
    }));
    renderList("all");
  });
}

function ticketCard(t) {
  const [cls, label] = STATUS_BADGE[t.status] || ["badge-gray", t.status || "—"];
  const c = document.createElement("div");
  c.className = "card ticket-card";
  c.innerHTML = `
    <div class="card-header">
      <h2 class="card-title"><i data-lucide="ticket"></i> ${ticketCode(t.number)}</h2>
      <span class="badge ${cls}"><span class="dot"></span>${label}</span>
    </div>
    <div class="card-body">
      <div class="li"><span class="li-key">Rodada</span><span class="li-val">${esc(t.round_label || "—")}</span></div>
      <div class="li"><span class="li-key">Palpites</span><span class="li-val">${esc(String(t.picks_count ?? "—"))}</span></div>
      <div class="li"><span class="li-key">Pontos</span><span class="li-val">${esc(String(t.points ?? "—"))}</span></div>
      <div class="li"><span class="li-key">Adquirido</span><span class="li-val">${esc(dateShort(t.acquired_at))}</span></div>
      <div class="tc-actions">
        <a class="btn btn-outline btn-sm" href="#/picks">Ver Ticket</a>
        <a class="btn btn-ghost btn-sm" href="#/history">Histórico</a>
      </div>
    </div>`;
  return c;
}