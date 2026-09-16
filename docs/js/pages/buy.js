/* js/pages/buy.js — Comprar Tickets (calcula valor visual, não simula pagamento) */
import { loadTemplate, run } from "./loader.js";
import { brl } from "../../utils/format.js";
import { set } from "../../utils/storage.js";
import { toastInfo } from "../../components/toast.js";

const UNIT_PRICE = 10;

export async function render(view) {
  await loadTemplate(view, "buy.html");
  await run(view, async () => {
    let qty = 1;
    const el = {
      value: view.querySelector("#qty-value"),
      unit: view.querySelector("#unit-price"),
      summary: view.querySelector("#qty-summary"),
      total: view.querySelector("#total-price"),
      minus: view.querySelector("#qty-minus"),
      plus: view.querySelector("#qty-plus"),
      go: view.querySelector("#go-payment"),
    };
    el.unit.textContent = brl(UNIT_PRICE);

    const refresh = () => {
      el.value.textContent = qty;
      el.summary.textContent = qty;
      el.total.textContent = brl(qty * UNIT_PRICE);
      el.minus.disabled = qty <= 1;
      el.go.dataset.buyQty = qty;
    };

    el.minus.addEventListener("click", () => { if (qty > 1) { qty--; refresh(); } });
    el.plus.addEventListener("click", () => { qty++; refresh(); });

    el.go.addEventListener("click", (e) => {
      e.preventDefault();
      // prepara pedido pendente para a tela de pagamento (não cria cobrança)
      set("pendingOrder", { qty, unitPrice: UNIT_PRICE, total: qty * UNIT_PRICE, createdAt: Date.now() });
      toastInfo("Resumo do pedido", `${qty} ticket(s) · ${brl(qty * UNIT_PRICE)}`);
      window.location.hash = "#/payment";
    });

    refresh();
  });
}