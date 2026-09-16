/* js/register.js — Lógica da página de Cadastro */
import { initTheme } from "./theme.js";
import { isEmail } from "../utils/format.js";
import { register } from "./api/auth.js";
import { toastError, toastSuccess, toastInfo } from "../components/toast.js";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.addEventListener("click", toggleThemeBtn));
  document.querySelectorAll(".input-ico[data-target]").forEach((btn) =>
    bindToggleVisibility(btn, document.getElementById(btn.dataset.target))
  );
  ["username", "email", "password", "confirm"].forEach((f) =>
    document.getElementById(f).addEventListener("input", () => clearErr(f))
  );
  document.getElementById("register-form").addEventListener("submit", onSubmit);
});

async function onSubmit(e) {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;
  const btn = document.getElementById("submit-btn");
  let valid = true;

  if (!username) { showErr("username", "Informe um nome de usuário."); valid = false; }
  else if (username.length < 3) { showErr("username", "Mínimo 3 caracteres."); valid = false; }

  if (!email) { showErr("email", "Informe seu e-mail."); valid = false; }
  else if (!isEmail(email)) { showErr("email", "Formato de e-mail inválido."); valid = false; }

  if (!password) { showErr("password", "Informe uma senha."); valid = false; }
  else if (password.length < 8) { showErr("password", "Mínimo 8 caracteres."); valid = false; }

  if (!confirm) { showErr("confirm", "Repita a senha."); valid = false; }
  else if (password !== confirm) { showErr("confirm", "As senhas não coincidem."); valid = false; }

  if (!valid) return;

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner in-btn"></span> Criando conta…`;
  try {
    const res = await register({ username, email, password });
    toastSuccess("Conta criada", "Já pode entrar com seu e-mail.");
    setTimeout(() => { window.location.replace("login.html"); }, 500);
  } catch (err) {
    if (err.field) showErr(err.field, err.message);
    else toastError("Erro ao criar a conta", err.message || "Tente novamente.");
    btn.disabled = false;
    btn.textContent = "Criar conta";
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