/* js/recover.js — Lógica da página de Recuperação de senha */
import { initTheme } from "./theme.js";
import { isEmail } from "../utils/format.js";
import { hydrateIcons } from "../utils/dom.js";
import { toastError, toastSuccess, toastInfo } from "../components/toast.js";
import { request } from "./api/client.js";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  // Converte os <i data-lucide> do HTML em SVG já no carregamento
  // (ícones do painel lateral).
  hydrateIcons();
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

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner in-btn"></span> Enviando…`;
  try {
    await request("/auth/recover", { method: "POST", body: { email } });
    toastSuccess("Solicitação registrada", "Se o e-mail existir, você receberá um link seguro.");
    btn.innerHTML = "Link solicitado";
  } catch (error) {
    toastError("Não foi possível solicitar", error.message || "Tente novamente.");
    btn.disabled = false;
    btn.textContent = "Enviar link de recuperação";
  }
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