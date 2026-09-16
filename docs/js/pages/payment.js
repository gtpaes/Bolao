/* js/pages/payment.js — Pagamento Pix */
import { loadTemplate, run } from "./loader.js";
import { get } from "../../utils/storage.js";
import { createPayment } from "../api/payments.js";
import { brl } from "../../utils/format.js";
import { esc } from "../../utils/dom.js";
import { stateNode } from "../../utils/states.js";
import { toastError, toastInfo } from "../../components/toast.js";

export async function render(view) {
  await loadTemplate(view, "payment.html");
  await run(view, async () => {
    const order = get("pendingOrder", { qty: 1, unitPrice: 10, total: 10 });

    renderStepper(view, "creating");
    const host = view.querySelector('[data-host="payment"]');
    const chip = view.querySelector('[data-host="status-chip"]');
    chip.textContent = "Preparado";

    // UI inicial: gerando
    host.replaceChildren(stateNode("loading", { title: "Gerando pagamento...", message: "Aguarde enquanto a cobrança Pix é criada." }));
    view.querySelector(".state").innerHTML = `<span class="spinner"></span><h3>Gerando pagamento...</h3><p>Aguarde enquanto a cobrança Pix é criada.</p>`;

    const summary = document.createElement("div");
    summary.className = "card";
    summary.innerHTML = `
      <div class="li"><span class="li-key">Tickets</span><span class="li-val">${esc(String(order.qty))}</span></div>
      <div class="li"><span class="li-key">Valor unitário</span><span class="li-val">${brl(order.unitPrice)}</span></div>
      <div class="li"><span class="li-key">Total</span><span class="li-val" style="font-weight:800;font-size:1.2rem">${brl(order.total)}</span></div>
      <div class="divider"></div>
      <div id="pay-result"></div>
    `;
    host.replaceChildren(summary);

    const resultHost = summary.querySelector("#pay-result");
    resultHost.appendChild(stateNode("off", {
      title: "Pagamento via Pix",
      message: "O QR Code e o código copia-e-cola aparecerão aqui.",
    }));

    // Tenta criar a cobrança
    let payment = null;
    try {
      payment = await createPayment({ quantity: order.qty });
    } catch (e) {
      resultHost.replaceChildren(paymentErrorState(order, e));
      renderStepper(view, "error");
      chip.textContent = "Falha na cobrança";
      return;
    }
  });
}

function renderStepper(view, state) {
  const steps = ["Cobrança", "Pix", "Confirmação"];
  const idx = { creating: 0, waiting: 1, approved: 2, error: 0 }[state] || 0;
  const box = view.querySelector("#pay-stepper");
  box.innerHTML = steps.map((label, i) => {
    const done = i < idx ? "done" : "";
    const active = i === idx && state !== "error" ? "active" : "";
    const ico = done ? "check" : i === 1 ? "qr-code" : i === 2 ? "shield-check" : "credit-card";
    return `<div class="pay-step ${done} ${active}"><span class="ps-ico"><i data-lucide="${ico}"></i></span><span class="ps-state">${label}</span></div>${i < steps.length - 1 ? '<div class="pay-bar ' + done + '"></div>' : ""}`;
  }).join("");
  view.querySelectorAll("i[data-lucide]").forEach(() => {});
  if (window.lucide) window.lucide.createIcons({ nodes: [box] });
}

function paymentErrorState(order, err) {
  const w = document.createElement("div");
  w.innerHTML = `
    <div class="pix-status">
      <span class="ps-big-ico" style="background:var(--danger-bg);color:var(--danger)"><i data-lucide="alert-circle"></i></span>
      <h3>Erro ao processar pagamento</h3>
      <p class="t-muted">Não foi possível gerar a cobrança. Tente novamente.</p>
      <button class="btn btn-primary" id="retry-pay"><i data-lucide="refresh-cw"></i> Tentar novamente</button>
    </div>`;
  w.querySelector("#retry-pay").addEventListener("click", () => {
    toastInfo("Nova tentativa", "Gerando a cobrança novamente.");
    window.location.reload();
  });
  return w;
}