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
  closed: ["badge-amber", "Palpites encerrados"],
  scored: ["badge-blue", "Pontuado"],
  active: ["badge-green", "Em andamento"],
  finished: ["badge-gray", "Finalizado"],
};

export async function render(view) {
  await loadTemplate(view, "tickets.html");
  await run(view, async () => {
    const tabs = view.querySelector("#ticket-tabs");
    // "Pontuados" saiu: o ticket nunca recebe o status "scored" (o fechamento já o
    // marca como "closed" antes de pontuar), então o filtro nunca casava.
    const statuses = [
      ["all", "Todos"],
      ["released", "Liberados"],
      ["closed", "Encerrados"],
    ];
    tabs.innerHTML = statuses.map(([k, l]) => `<button class="tab ${k === "all" ? "active" : ""}" data-s="${k}">${l}</button>`).join("");

    let data = { tickets: [], round: null };
    try { data = await listTickets(); } catch (e) { data = { tickets: [], round: null }; }
    const tickets = data.tickets || [];
    const listHost = view.querySelector('[data-host="tickets"]');
    if (!listHost) return; // estrutura inesperada: melhor sair do que estourar na tela

    // Cada ticket vale para UMA rodada: aqui aparecem só os da rodada corrente.
    // Os tickets das rodadas anteriores ficam no histórico (com palpites e pontos).
    listHost.insertAdjacentHTML("beforebegin",
      `<p class="t-muted t-small">${data.round ? `Tickets da <b>rodada ${esc(String(data.round.number))}</b>.` : "Nenhuma rodada corrente."} Os tickets de rodadas anteriores ficam no <a href="#/history">histórico</a>.</p>`);

    // Estado vazio com os atalhos DENTRO do mesmo nó, que é substituído a cada
    // render: antes os botões entravam como irmãos do host e se acumulavam.
    const showEmpty = ({ title, message, actions = false }) => {
      const wrap = document.createElement("div");
      wrap.appendChild(stateNode("empty", { title, message }));
      if (actions) {
        const bar = document.createElement("div");
        bar.className = "state";
        bar.style.padding = "var(--space-5)";
        bar.innerHTML = `<a class="btn btn-primary btn-lg" href="#/buy">Comprar tickets</a> <a class="btn btn-ghost btn-lg" href="#/history">Ver histórico</a>`;
        wrap.appendChild(bar);
      }
      listHost.replaceChildren(wrap);
    };

    const renderList = (filter) => {
      if (!tickets.length) {
        showEmpty({
          title: data.round ? `Sem tickets na rodada ${data.round.number}` : "Você ainda não tem tickets",
          message: "Cada ticket participa de uma rodada: compre um ticket desta rodada para palpitar.",
          actions: true,
        });
        return;
      }
      const list = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
      if (!list.length) {
        showEmpty({ title: "Nenhum ticket neste status", message: "Troque o filtro ou veja todos os tickets." });
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "grid";
      wrap.replaceChildren(...list.map(ticketCard));
      listHost.replaceChildren(wrap);
    };

    // As abas são ligadas SEMPRE: antes o `return` do caso "sem tickets" pulava esta
    // parte e os botões ficavam inertes (só "Todos" parecia ativo, por já vir marcado).
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