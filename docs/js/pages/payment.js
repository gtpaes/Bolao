/* js/pages/payment.js — Pagamento Pix */
import { loadTemplate, run } from "./loader.js";
import { get } from "../../utils/storage.js";
import { createPayment, paymentStatus } from "../api/payments.js";
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

    host.replaceChildren(stateNode("loading", { title: "Gerando pagamento...", message: "Aguarde enquanto a cobrança Pix é criada." }));

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
    let payment = null;
    try {
      payment = await createPayment({ quantity: order.qty });
      renderPixPaymentState(resultHost, payment, order, view, chip);
      startPaymentPolling(view, payment.id, chip, resultHost);
    } catch (e) {
      resultHost.replaceChildren(paymentErrorState(order, e));
      renderStepper(view, "error");
      chip.textContent = "Falha na cobrança";
      toastError("Erro no pagamento", e.message || "Não foi possível gerar a cobrança.");
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

function renderPixPaymentState(resultHost, payment, order, view, chip) {
  renderStepper(view, "waiting");
  chip.textContent = "Aguardando Pix";

  const qrMarkup = payment.qrcode
    ? `<img alt="QR Code do Pix" src="data:image/png;base64,${payment.qrcode}" style="max-width:220px;width:100%;display:block;margin:0 auto 12px;border-radius:12px;background:#fff;padding:8px;" />`
    : "";

  const codeText = payment.qrcode_text || "Código Pix indisponível no momento.";
  const total = Number(payment.amount ?? order.total ?? 0);

  resultHost.innerHTML = `
    <div class="pix-status">
      <div class="pix-qr">${qrMarkup}</div>
      <h3>Pagamento via Pix</h3>
      <p class="t-muted">Valor: <strong>${brl(total)}</strong></p>
      <p class="t-muted">Expira em: <strong>${Math.max(1, Number(payment.expires_in || 1800))}s</strong></p>
      <div class="code-box" style="margin-top:12px;word-break:break-all;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:12px;">${esc(codeText)}</div>
      <button class="btn btn-primary" data-copy-pix="true" style="margin-top:12px;">Copiar código Pix</button>
    </div>
  `;

  const btn = resultHost.querySelector('[data-copy-pix="true"]');
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeText);
        toastInfo("Código Pix copiado", "Você pode colar no app do seu banco.");
      } catch (e) {
        toastError("Não foi possível copiar", "Selecione o código manualmente.");
      }
    });
  }
}

async function startPaymentPolling(view, paymentId, chip, resultHost) {
  let attempts = 0;
  const maxAttempts = 36;

  const tick = async () => {
    attempts += 1;
    try {
      const status = await paymentStatus(paymentId);
      const current = String(status && status.status ? status.status : "pending");

      if (current === "approved") {
        renderStepper(view, "approved");
        chip.textContent = "Pagamento aprovado";
        resultHost.innerHTML = `
          <div class="pix-status">
            <span class="ps-big-ico" style="background:var(--success-bg);color:var(--success)"><i data-lucide="check-circle"></i></span>
            <h3>Pagamento confirmado</h3>
            <p class="t-muted">Seu(s) ticket(s) foi(ram) liberado(s) para aposta.</p>
          </div>`;
        if (window.lucide) window.lucide.createIcons({ nodes: resultHost });
        return;
      }

      if (current === "expired" || current === "refused") {
        renderStepper(view, "error");
        chip.textContent = current === "expired" ? "Pix expirado" : "Pagamento recusado";
        resultHost.innerHTML = `
          <div class="pix-status">
            <span class="ps-big-ico" style="background:var(--danger-bg);color:var(--danger)"><i data-lucide="alert-circle"></i></span>
            <h3>${current === "expired" ? "Cobrança expirada" : "Pagamento recusado"}</h3>
            <p class="t-muted">Tente gerar uma nova cobrança e repetir a compra.</p>
          </div>`;
        if (window.lucide) window.lucide.createIcons({ nodes: resultHost });
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(tick, 5000);
      } else {
        renderStepper(view, "waiting");
        chip.textContent = "Aguardando confirmação";
      }
    } catch (e) {
      if (attempts < maxAttempts) {
        setTimeout(tick, 5000);
      }
    }
  };

  setTimeout(tick, 2000);
}

function paymentErrorState(order, err) {
  // Mensagem do servidor quando existe: "a rodada fechou" não se resolve
  // tentando de novo, e o usuário precisa entender o motivo.
  const detail = (err && err.message) ? err.message : "Não foi possível gerar a cobrança. Tente novamente.";
  const w = document.createElement("div");
  w.innerHTML = `
    <div class="pix-status">
      <span class="ps-big-ico" style="background:var(--danger-bg);color:var(--danger)"><i data-lucide="alert-circle"></i></span>
      <h3>Erro ao processar pagamento</h3>
      <p class="t-muted">${esc(detail)}</p>
      <button class="btn btn-primary" id="retry-pay"><i data-lucide="refresh-cw"></i> Tentar novamente</button>
    </div>`;
  w.querySelector("#retry-pay").addEventListener("click", () => {
    toastInfo("Nova tentativa", "Gerando a cobrança novamente.");
    window.location.reload();
  });
  if (window.lucide) window.lucide.createIcons({ nodes: w });
  return w;
}