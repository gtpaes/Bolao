/* js/recover.js — Lógica da página de Recuperação de senha */
import { initTheme } from "./theme.js";
import { isEmail } from "../utils/format.js";
import { toastError, toastSuccess, toastInfo } from "../components/toast.js";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.addEventListener("click", toggleThemeBtn));
  document.getElementById("email").addEventListener("input", () => clearErr("email"));
  document.getElementById("recover-form").addEventListener("submit", onSubmit);
});

async function onSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const btn = document.getElementById("submit-btn");

  if (!email || !isEmail(email)) {
    showErr("email", "Informe um e-mail válido.");
    return;
  }

  // O envio do link é feito por e-mail.
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner in-btn"></span> Enviando…`;
  toastSuccess("Solicitação registrada", "Se o e-mail existir, você receberá um link seguro.");
  setTimeout(() => { window.location.replace("login.html"); }, 1200);
}

function showErr(field, msg) {
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

function toggleThemeBtn() {
  const html = document.documentElement;
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  try { localStorage.setItem("bolao.theme", next); } catch (e) { /* noop */ }
  toastInfo(next === "dark" ? "Modo escuro" : "Modo claro", "");
}