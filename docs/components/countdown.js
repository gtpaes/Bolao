/* components/countdown.js — Contagem regressiva reutilizável até uma data */
import { el } from "../utils/dom.js";
import { timeLeft } from "../utils/format.js";

/**
 * Cria uma contagem regressiva até `target` (Date|ISO). Devolve o nó + { stop }.
 * @param {Date|string} target
 * @param {string} expiredLabel texto quando expirou
 */
export function countdown(target, expiredLabel = "Encerrado") {
  const node = el(`
    <div class="countdown" role="timer" aria-live="polite">
      <div class="cd-cell"><span class="cd-num" data-u="d">0</span><span class="cd-label">dias</span></div>
      <div class="cd-cell"><span class="cd-num" data-u="h">0</span><span class="cd-label">horas</span></div>
      <div class="cd-cell"><span class="cd-num" data-u="m">0</span><span class="cd-label">min</span></div>
      <div class="cd-cell"><span class="cd-num" data-u="s">0</span><span class="cd-label">seg</span></div>
    </div>`);
  const cells = Object.fromEntries(
    Array.from(node.querySelectorAll(".cd-num")).map((c) => [c.dataset.u, c])
  );

  const tick = () => {
    const t = timeLeft(target);
    if (t.expired) {
      cells.d.textContent = "—"; cells.h.textContent = "—"; cells.m.textContent = "—"; cells.s.textContent = "—";
      if (window.__onCountExpired) window.__onCountExpired();
      return false;
    }
    cells.d.textContent = t.d; cells.h.textContent = pad(t.h);
    cells.m.textContent = pad(t.m); cells.s.textContent = pad(t.s);
    return true;
  };
  tick();
  const iv = setInterval(() => { if (!tick()) clearInterval(iv); }, 1000);
  return { node, stop: () => clearInterval(iv) };
}
const pad = (n) => String(n).padStart(2, "0");

/** Texto herdado do horário de fechamento (para selos "encerrados"). */
export function isExpired(target) {
  return timeLeft(target).expired;
}