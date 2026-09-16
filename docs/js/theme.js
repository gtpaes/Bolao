/* js/theme.js — Gerenciamento de tema (light/dark) com persistência */

const KEY = "bolao.theme";

export function getTheme() {
  return localStorage.getItem(KEY) || "light";
}

export function setTheme(theme, { persist = true } = {}) {
  document.documentElement.setAttribute("data-theme", theme);
  if (persist) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* noop */ }
  }
  updateToggleButtons(theme);
}

export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/** Aplica tema salvo no carregamento inicial. */
export function initTheme() {
  const t = getTheme();
  document.documentElement.setAttribute("data-theme", t);
  updateToggleButtons(t);
}

function updateToggleButtons(theme) {
  const icon = theme === "dark" ? "sun" : "moon";
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.setAttribute("aria-label", theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro");
    btn.title = theme === "dark" ? "Modo claro" : "Modo escuro";
    const i = btn.querySelector("i[data-lucide]");
    if (i) i.setAttribute("data-lucide", icon);
  });
  if (typeof window.lucide !== "undefined") {
    try { window.lucide.createIcons(); } catch (e) { /* noop */ }
  }
}