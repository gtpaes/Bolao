/* components/toast.js — Sistema de toasts reutilizável */

let zone = null;

function ensureZone() {
  if (zone && document.contains(zone)) return zone;
  zone = document.createElement("div");
  zone.className = "toast-zone";
  zone.setAttribute("role", "region");
  zone.setAttribute("aria-label", "Notificações");
  document.body.appendChild(zone);
  return zone;
}

/**
 * Exibe um toast.
 * @param {string} title
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} ttl ms
 */
export function toast(title, message = "", type = "info", ttl = 4000) {
  const z = ensureZone();
  const icons = { success: "check-circle", error: "alert-circle", info: "info" };
  const node = document.createElement("div");
  node.className = `toast toast-${type}`;
  node.setAttribute("role", type === "error" ? "alert" : "status");
  node.innerHTML = `
    <span class="t-ico"><i data-lucide="${icons[type] || "info"}"></i></span>
    <div class="t-body">
      <div class="t-title"></div>
      <div class="t-msg"></div>
    </div>
    <button class="icon-btn toast-close" aria-label="Fechar"><i data-lucide="x"></i></button>
  `;
  node.querySelector(".t-title").textContent = title;
  node.querySelector(".t-msg").textContent = message;
  node.querySelector(".toast-close").addEventListener("click", () => dismiss(node));
  z.appendChild(node);
  if (typeof window.lucide !== "undefined") window.lucide.createIcons({ nodes: [node] });

  const timer = setTimeout(() => dismiss(node), ttl);
  node.addEventListener("mouseenter", () => clearTimeout(timer));
  return node;
}

export const toastSuccess = (t, m) => toast(t, m, "success");
export const toastError = (t, m) => toast(t, m, "error");
export const toastInfo = (t, m) => toast(t, m, "info");

function dismiss(node) {
  if (!document.contains(node)) return;
  node.classList.add("leaving");
  setTimeout(() => node.remove(), 200);
}