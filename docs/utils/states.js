/* utils/states.js — Renderizadores de estados (loading/vazio/erro/indisponível).
   Não inventam dados reais; apenas comunicam "estado". */

import { esc, icon, el } from "./dom.js";

const iconFor = {
  empty: "inbox",
  error: "alert-circle",
  off: "plug-zap",
  loading: "loader",
  locked: "lock",
  search: "search",
};

/**
 * Retorna um nó de estado.
 * @param {string} kind  'empty'|'error'|'off'|'locked'
 * @param {object} opts  { title, message, ico }
 */
export function stateNode(kind, opts = {}) {
  const title = opts.title || defaultTitle(kind);
  const message = opts.message || defaultMessage(kind);
  const wrap = el(`
    <div class="state" role="status">
      <span class="state-ico ${kind === 'error' ? 'danger' : kind === 'off' || kind === 'locked' ? 'muted' : ''}">
        <i data-lucide="${iconFor[kind] || 'info'}"></i>
      </span>
      <h3>${esc(title)}</h3>
      <p>${esc(message)}</p>
    </div>
  `);
  return wrap;
}

function defaultTitle(kind) {
  const map = { empty: "Nada por aqui ainda", error: "Não foi possível carregar", off: "Indisponível no momento", locked: "Bloqueado" };
  return map[kind] || "";
}
function defaultMessage(kind) {
  const map = {
    empty: "Os dados aparecerão aqui assim que estiverem disponíveis.",
    error: "Ocorreu um erro ao buscar os dados. Tente novamente.",
    off: "Este recurso está indisponível no momento.",
    locked: "Esta ação não está disponível para você agora.",
  };
  return map[kind] || "";
}

/** Nó de carregando (spinner) */
export function loadingNode(label = "Carregando...") {
  const wrap = el(`<div class="state" role="status">
      <span class="spinner"></span>
      <p>${esc(label)}</p>
    </div>`);
  return wrap;
}

/** Esqueleto de lista (placeholder visual sem dados) */
export function skeletonList(count = 3, h = 96) {
  const wrap = document.createElement("div");
  wrap.className = "grid";
  for (let i = 0; i < count; i++) {
    const block = document.createElement("div");
    block.className = "card skeleton";
    block.style.height = h + "px";
    wrap.appendChild(block);
  }
  return wrap;
}

/** Monta um <select> a partir de opções [{value,label}] */
export function optionsToSelect(opts, current) {
  return opts
    .map((o) => `<option value="${esc(o.value)}" ${o.value === current ? "selected" : ""}>${esc(o.label)}</option>`)
    .join("");
}