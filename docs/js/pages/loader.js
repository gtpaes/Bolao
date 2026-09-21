/* js/pages/loader.js — Helper para carregar templates HTML do /pages */
import { hydrateIcons } from "../../utils/dom.js";
import { errorState, logError } from "../../utils/states.js";

/* Época da renderização: o router incrementa `data-render` no container a cada
   navegação. Assim uma página que termina de carregar DEPOIS de o usuário trocar de
   tela não escreve mais em cima do conteúdo da outra — era isso que gerava os erros
   "Cannot read properties of null" (host sumiu) e "The element has no parent"
   (host trocado no meio do carregamento).

   `lockedEpochs` guarda, POR CONTAINER, a época do template que está de fato na tela;
   é o valor que o `run` compara. Sem isto o `run` leria a época já alterada pela
   navegação nova e nunca detectaria que a página dele saiu de cena. */
const lockedEpochs = new WeakMap();
function epochOf(container) {
  return container && container.dataset ? (container.dataset.render || null) : null;
}

/** O container saiu de cena (ou a navegação mudou) desde que começamos? */
export function isStaleRender(container, epoch) {
  if (!container || container.isConnected === false) return true;
  return epoch !== null && epochOf(container) !== epoch;
}

/**
 * Carrega um template .html da pasta /pages e injeta no container.
 * Devolve `false` quando a renderização ficou obsoleta (o chamador deve parar).
 */
export async function loadTemplate(container, path) {
  if (!path) {
    if (container) container.innerHTML = "<div class='state'>Template não localizado.</div>";
    return false;
  }
  const epoch = epochOf(container);
  const res = await fetch(`pages/${path}`);
  if (!res.ok) throw new Error("Falha ao carregar a página.");
  const html = await res.text();
  if (isStaleRender(container, epoch)) return false;
  container.innerHTML = html;
  lockedEpochs.set(container, epoch); // esta é a tela que está no ar
  hydrateIcons(container);
  return true;
}

/** Aplica um async handler com tratamento de erro/estado. */
export async function run(view, fn) {
  const epoch = lockedEpochs.has(view) ? lockedEpochs.get(view) : epochOf(view);
  // Navegou no meio do carregamento: não mexe no DOM (que já é de outra página).
  if (isStaleRender(view, epoch)) return;
  try {
    await fn(view);
  } catch (e) {
    logError(e);
    if (isStaleRender(view, epoch)) return;
    // `appendChild` (e não insertAdjacentHTML): não estoura em nó desanexado e some
    // junto quando a página é trocada. A mensagem técnica fica só no console.
    view.appendChild(errorState(e));
    hydrateIcons(view);
  }
}