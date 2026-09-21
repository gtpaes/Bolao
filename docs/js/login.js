/* js/login.js — Lógica da página de Login */
import { initTheme } from "./theme.js";
import { isEmail } from "../utils/format.js";
import { hydrateIcons } from "../utils/dom.js";
import { login, isAuthenticated } from "./api/auth.js";
import { toastError, toastSuccess, toastInfo } from "../components/toast.js";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  // Converte os <i data-lucide> do HTML em SVG já no carregamento
  // (ícones do painel lateral e do botão "mostrar senha").
  hydrateIcons();
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.addEventListener("click", toggleThemeBtn));

  // Se já tem sessão, mostra e deixa o login fluir para o index
  bindToggleVisibility(document.getElementById("toggle-pass"), document.getElementById("password"));
  document.getElementById("login-form").addEventListener("submit", onSubmit);
  document.getElementById("password").addEventListener("input", () => clearErr("password"));
  document.getElementById("email").addEventListener("input", () => clearErr("email"));

});

async function onSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("submit-btn");
  let valid = true;

  if (!email) { showErr("email", "Informe seu e-mail."); valid = false; }
  else if (!isEmail(email)) { showErr("email", "E-mail em formato inválido."); valid = false; }

  if (!password) { showErr("password", "Informe sua senha."); valid = false; }
  else if (password.length < 8) { showErr("password", "A senha deve ter ao menos 8 caracteres."); valid = false; }

  if (!valid) return;

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner in-btn"></span> Entrando…`;
  try {
    const res = await login({ email, password });
    toastSuccess("Bem-vindo de volta!", `Olá, ${res.data.username}.`);
    setTimeout(() => { window.location.replace("index.html"); }, 350);
  } catch (err) {
    if (err.field) showErr(err.field, err.message);
    else toastError("Falha no login", err.message || "Não foi possível entrar.");
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
}

function showErr(field, msg) {
  clearErr(field);
  const box = document.getElementById("f-" + field);
  const el = document.getElementById("err-" + field);
  if (box) box.classList.add("field-error");
  if (el) { el.textContent = msg; el.hidden = false; }
}
function clearErr(field) {
  const box = document.getElementById("f-" + field);
  const el = document.getElementById("err-" + field);
  if (box) box.classList.remove("field-error");
  if (el) { el.textContent = ""; el.hidden = true; }
}

function bindToggleVisibility(btn, input) {
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    const ico = btn.querySelector("i[data-lucide]") || btn.querySelector("svg[data-lucide]") || btn.firstElementChild;
    if (ico) ico.setAttribute("data-lucide", show ? "eye-off" : "eye");
    if (window.lucide) window.lucide.createIcons({ nodes: [btn] });
  });
}

function toggleThemeBtn() {
  const html = document.documentElement;
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  try { localStorage.setItem("bolao.theme", next); } catch (e) { /* noop */ }
  toastInfo(next === "dark" ? "Modo escuro" : "Modo claro", "");
}
