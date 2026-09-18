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
  // O símbolo reflete o tema atual: lua no escuro, sol no claro.
  const iconName = theme === "dark" ? "moon" : "sun";
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.setAttribute("aria-label", theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro");
    btn.title = theme === "dark" ? "Modo claro" : "Modo escuro";
    // Após o Lucide renderizar, o <i> vira <svg> mantendo o atributo data-lucide.
    const holder = btn.querySelector("i[data-lucide], svg[data-lucide]");
    if (!holder) return;
    // Evita acumular classes do ícone anterior (ex.: lucide-moon) a cada troca.
    Array.from(holder.classList).forEach((c) => {
      if (c.indexOf("lucide-") === 0) holder.classList.remove(c);
    });
    holder.setAttribute("data-lucide", iconName);
    if (typeof window.lucide === "undefined" || !window.lucide.createIcons) return;
    try {
      // `root` limita a atualização ao botão (versões sem suporte simplesmente usam o documento).
      window.lucide.createIcons({ root: btn, attrs: { "aria-hidden": "true" } });
    } catch (e) { /* noop */ }
  });
}