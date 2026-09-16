/* js/pages/loader.js — Helper para carregar templates HTML do /pages */
import { hydrateIcons } from "../../utils/dom.js";

/**
 * Carrega um template .html da pasta /pages e injeta no container.
 * Usado pelas páginas da área do usuário/admin/dev.
 */
export async function loadTemplate(container, path) {
  if (!path) {
    container.innerHTML = "<div class='state'>Template não localizado.</div>";
    return;
  }
  const res = await fetch(`pages/${path}`);
  if (!res.ok) throw new Error("Falha ao carregar a página.");
  const html = await res.text();
  container.innerHTML = html;
  hydrateIcons(container);
}

/** Aplica um async handler com loading + tratamento de erro/estado. */
export async function run(view, fn) {
  try {
    await fn(view);
  } catch (e) {
    console.error(e);
    view.insertAdjacentHTML("beforeend", `
      <div class="state">
        <span class="state-ico danger"><i data-lucide="alert-circle"></i></span>
        <h3>Falha ao carregar</h3>
        <p>${e && e.message ? e.message : "Erro inesperado."}</p>
      </div>`);
    hydrateIcons(view);
  }
}