/* components/loading.js — Overlay global de carregamento "bola no gol".

   APARECE QUANDO:
   - Uma requisição demora mais que DELAY_MS (evita "piscar" em chamadas rápidas), ou
   - Alguém chama showLoading({ immediate: true }) — ex.: o app.js liga o overlay já no
     carregamento inicial para esconder o shell ainda sem conteúdo.

   POR QUE REF-COUNT:
   Várias requisições rodam em paralelo (ex.: Dashboard busca rodada, tickets, jogos e
   ao vivo). Cada uma chama showLoading() no início e hideLoading() no fim. Sem um
   contador, a primeira requisição a terminar esconderia o overlay no meio das outras.
   Aqui o overlay só some quando TODAS terminam (refs chega a 0).

   O overlay só existe no shell do app (index.html), sinalizado por ".app". Nas
   páginas de autenticação (login/register/recover/reset-password) as chamadas de API
   passam por aqui mas ignoram o overlay (elas já têm o spinner no próprio botão). */

const DELAY_MS = 250; // só exibe depois desse tempo de espera (evita flash)
const ROOT_SELECTOR = ".app"; // presente apenas no shell do app (index.html)

let refs = 0;        // requisições em andamento
let timer = null;    // agendamento do delay para aparecer
let hideId = null;   // limpeza do nó após o fade-out
let overlay = null;  // nó do overlay (criado sob demanda)

/** Liga o loading. `immediate` pula o delay (usado no carregamento inicial). */
export function showLoading({ immediate = false } = {}) {
  if (!isSupported()) return;
  refs += 1;
  if (immediate) return ensureVisible();
  if (isVisible()) return; // já na tela — apenas mantém o contador
  if (timer) return; // já agendado para aparecer
  timer = setTimeout(() => {
    timer = null;
    ensureVisible();
  }, DELAY_MS);
}

/** Desliga o loading quando a última requisição em andamento termina. */
export function hideLoading() {
  if (refs > 0) refs -= 1;
  if (refs > 0) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  ensureHidden();
}

/** Mantém o loading ligado durante todo o `await` de `fn`. */
export async function withLoading(fn, opts = {}) {
  showLoading(opts);
  try {
    return await fn();
  } finally {
    hideLoading();
  }
}

function isSupported() {
  return typeof document !== "undefined" && !!document.querySelector(ROOT_SELECTOR);
}

function isVisible() {
  return !!overlay && overlay.classList.contains("load-overlay--show");
}

function ensureVisible() {
  clearTimeout(hideId); // uma nova exibição cancela a remoção pendente
  if (overlay) {
    overlay.classList.add("load-overlay--show");
    return;
  }
  overlay = document.createElement("div");
  overlay.className = "load-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="load-overlay__card">
      <div class="load-goal">
        <svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bola de futebol sendo chutada para o gol">
          <!-- campo -->
          <rect class="g-pitch" x="4" y="122" width="212" height="10" rx="5" />
          <rect class="g-pitch-line" x="4" y="120" width="212" height="2" rx="1" />
          <!-- gol em perfil (poste frontal, travessão e poste traseiro) -->
          <g class="g-goal" fill="none" stroke-linecap="round">
            <path d="M190 56 V120" stroke-width="6" />
            <path d="M166 56 V120" stroke-width="5" />
            <path d="M166 56 H190" stroke-width="5" />
          </g>
          <!-- rede -->
          <g class="g-net" stroke-width="2" fill="none" opacity=".55">
            <path d="M168 62 L190 68 M168 74 L190 80 M168 86 L190 92 M168 98 L190 104 M168 110 L190 114" />
            <path d="M174 56 L180 120" />
          </g>
          <!-- bola: corpo (.face) e painéis (.panel); cores vêm do CSS por tema -->
          <g class="g-ball">
            <circle class="face" cx="30" cy="116" r="9" />
            <path class="panel" d="M30 108.5 l3 1.1 1.1 3-1.1 3-3 1.1-3-1.1-1.1-3 1.1-3z" />
            <circle class="panel" cx="22" cy="112" r="1.5" />
            <circle class="panel" cx="38" cy="112" r="1.5" />
            <circle class="panel" cx="30" cy="124" r="1.5" />
          </g>
        </svg>
      </div>
      <p class="load-label">Carregando…</p>
    </div>`;
  document.body.appendChild(overlay);
  overlay.classList.add("load-overlay--show");
}

function ensureHidden() {
  if (!overlay) return;
  overlay.classList.remove("load-overlay--show");
  const node = overlay;
  clearTimeout(hideId);
  hideId = setTimeout(() => {
    // Só remove se ainda for o nó atual (uma reexibição o reutiliza).
    if (overlay === node) {
      node.remove();
      overlay = null;
    }
  }, 300);
}