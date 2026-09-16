/* utils/dom.js — Helpers DOM + ícones Lucide */

export const byId = (id) => document.getElementById(id);
export const qs = (sel, root) => (root || document).querySelector(sel);
export const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/** Escapa texto para injeção segura em HTML */
export function esc(v) {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Ícone Lucide. Gera um <i data-lucide>. Requer o script do Lucide carregado.
 * Se o Lucide não estiver disponível, o ícone fica como marcador visual mínimo (não falsifica).
 */
export function icon(name, cls = "") {
  const i = document.createElement("i");
  i.setAttribute("data-lucide", name);
  i.className = "lucide " + cls;
  i.setAttribute("aria-hidden", "true");
  return i;
}

/** Hidrata os <i data-lucide> já presentes (chamar após carregar o template). */
export function hydrateIcons(root) {
  if (typeof window.lucide === "undefined" || !window.lucide.createIcons) return;
  try {
    // Troca nomes de ícones que não existem na versão carregada por um fallback válido.
    // Evita o erro "icon name was not found in the provided icons object" no console.
    const known = window.lucide.icons ? Object.keys(window.lucide.icons) : null;
    const scope = root && root.querySelectorAll ? root : document;
    if (known && known.length) {
      const lower = new Set(known.map((k) => String(k).toLowerCase()));
      scope.querySelectorAll("i[data-lucide]").forEach((el) => {
        const name = el.getAttribute("data-lucide") || "";
        const pascal = name.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
        if (!lower.has(name.toLowerCase()) && !lower.has(pascal.toLowerCase())) {
          el.setAttribute("data-lucide", "circle");
        }
      });
    }
    window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
  } catch (e) { /* sem operação */ }
}

/** Cria um elemento a partir de uma string de marcação e devolve o primeiro filho. */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  const node = t.content.firstChild;
  return node;
}

/** Pré-renderiza um conjunto de <i data-lucide> em uma string de marcação. */
export function iconsHtml(names) {
  return names.map((n) => `<i data-lucide="${n}" aria-hidden="true"></i>`).join("");
}