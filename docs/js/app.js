/* js/app.js — Inicialização do shell do app (index.html) */

import { initTheme, toggleTheme } from "./theme.js";
import { currentProfile, currentRole, logout, requireAuth } from "./api/auth.js";
import { sidebarHtml, bottomNavHtml, moreSheetHtml } from "./nav.js";
import { initRouter, navigate } from "./router.js";
import { hydrateIcons, icon, byId, qs } from "../utils/dom.js";
import { initials } from "../utils/format.js";
import { openModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirm.js";
import { toastSuccess, toastInfo } from "../components/toast.js";

document.addEventListener("DOMContentLoaded", () => {
  if (!requireAuth()) return;
  initTheme();

  const profile = currentProfile();
  const role = currentRole() || "user";

  // Sidebar
  const sbNav = byId("sb-nav");
  if (sbNav) sbNav.innerHTML = sidebarHtml(role);

  // Bottom nav
  const bn = byId("bottom-nav");
  if (bn) bn.innerHTML = bottomNavHtml();

  // User chips
  hydrateUserChips(profile, role);

  // Logo -> dashboard
  document.querySelectorAll("[data-goto-home]").forEach((a) => a.addEventListener("click", () => navigate("dashboard")));

  // Theme toggles
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => btn.addEventListener("click", () => {
    const t = toggleTheme();
    toastInfo(t === "dark" ? "Modo escuro" : "Modo claro", "Preferência salva.");
  }));

  // Botão menu mobile (drawer)
  const menuBtn = byId("menu-btn");
  if (menuBtn) menuBtn.addEventListener("click", openDrawer);

  // Botão "mais" mobile
  const bnMore = byId("bn-more");
  if (bnMore) bnMore.addEventListener("click", () => openMoreSheet(role));

  // Logout
  document.querySelectorAll("[data-logout]").forEach((b) => b.addEventListener("click", onLogout));

  // Iniciar router
  initRouter();
});

function hydrateUserChips(profile, role) {
  const inits = initials(profile && profile.username);
  const roleLabel = role === "admin" ? "Administrador" : role === "dev" ? "Desenvolvedor" : "Participante";
  document.querySelectorAll("[data-user-chip]").forEach((chip) => {
    chip.innerHTML = `
      <span class="avatar" aria-hidden="true">${inits}</span>
      <span class="uc-meta">
        <span class="uc-name">${escapeHtml(profile ? profile.username : "Usuário")}</span>
        <span class="uc-role">${roleLabel}</span>
      </span>`;
  });
  const headerChip = byId("header-chip");
  if (headerChip) headerChip.innerHTML = `<span class="avatar avatar-sm" aria-hidden="true">${inits}</span>`;
}

function openDrawer() {
  if (byId("sidebar-drawer")) return;
  const role = currentRole() || "user";
  const drawer = document.createElement("div");
  drawer.id = "sidebar-drawer";
  drawer.className = "sidebar-drawer";
  drawer.innerHTML = `
    <div class="overlay" data-close-drawer></div>
    <aside class="drawer" aria-label="Menu">
      <div class="sb-brand">
        <span class="logo-mark"><i data-lucide="trophy"></i></span>
        <div><div class="logo-text">Bolão</div><div class="logo-sub">Futebol</div></div>
      </div>
      <nav class="sb-nav" data-drawer-nav></nav>
    </aside>`;
  document.body.appendChild(drawer);
  const nav = drawer.querySelector("[data-drawer-nav]");
  nav.innerHTML = sidebarHtml(role);
  hydrateIcons(drawer);
  drawer.querySelector("[data-close-drawer]").addEventListener("click", () => drawer.remove());
}

function openMoreSheet(role) {
  const body = document.createElement("div");
  body.className = "more-sheet";
  body.innerHTML = moreSheetHtml(role);
  const m = openModal({ title: "Mais opções", body, size: "modal-sm" });
  body.querySelectorAll("[data-close-sheet]").forEach((a) => a.addEventListener("click", () => m.close()));
}

async function onLogout(e) {
  e.preventDefault();
  const ok = await confirmDialog({
    title: "Sair da conta",
    message: "Deseja realmente sair?",
    confirmText: "Sair",
    danger: true,
  });
  if (!ok) return;
  logout();
  toastSuccess("Até logo!", "Sua sessão foi encerrada.");
  setTimeout(() => { window.location.replace("login.html"); }, 250);
}

function escapeHtml(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}