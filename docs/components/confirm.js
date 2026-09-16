/* components/confirm.js — Diálogo de confirmação reutilizável */
import { openModal } from "./modal.js";

/**
 * Confirmação.
 * @param {object} opts { title, message, confirmText, danger, onConfirm }
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title = "Confirmar", message = "", confirmText = "Confirmar", danger = false } = {}) {
  return new Promise((resolve) => {
    const footer = `
      <button class="btn btn-ghost" data-act="cancel">Cancelar</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${confirmText}</button>
    `;
    const body = `<p>${message}</p>`;
    const m = openModal({
      title, body, footer, size: "modal-sm",
      onClose: () => resolve(false),
    });
    m.overlay.querySelector('[data-act="cancel"]').addEventListener("click", () => m.close());
    m.overlay.querySelector('[data-act="ok"]').addEventListener("click", () => {
      resolve(true);
      m.close();
    });
  });
}