/* components/modal.js — Modal reutilizável (bottom sheet no mobile) */

/**
 * Abre um modal.
 * @param {object} opts { title, body(html string | Node), footer(html), size, onClose }
 * @returns { { close: fn, overlay: HTMLElement } }
 */
export function openModal({ title = "", body = "", footer = "", size = "", onClose } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", title || "Diálogo");

  const modal = document.createElement("div");
  modal.className = "modal" + (size ? " " + size : "");
  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title"></h3>
      <button class="icon-btn modal-close" aria-label="Fechar"><i data-lucide="x"></i></button>
    </div>
    <div class="modal-body"></div>
    ${footer ? `<div class="modal-footer"></div>` : ""}
  `;
  if (title) modal.querySelector(".modal-title").textContent = title;
  const bodyNode = modal.querySelector(".modal-body");
  if (typeof body === "string") bodyNode.innerHTML = body;
  else bodyNode.appendChild(body);
  if (footer) modal.querySelector(".modal-footer").innerHTML = footer;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  if (typeof window.lucide !== "undefined") window.lucide.createIcons({ nodes: [modal] });

  function close() {
    if (onClose) onClose();
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  modal.querySelector(".modal-close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.style.overflow = "hidden";
  modal.querySelector(".modal-close").focus();

  return { close, overlay };
}