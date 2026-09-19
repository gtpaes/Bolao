import { request } from "./api/client.js";

document.getElementById("reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;
  const token = new URLSearchParams(window.location.search).get("token");
  const button = document.getElementById("submit-btn");
  if (!token || password.length < 8 || password !== confirm) { button.textContent = "Confira a senha e o link"; return; }
  button.disabled = true;
  try {
    await request("/auth/reset-password", { method: "POST", body: { token, password } });
    button.textContent = "Senha atualizada";
    window.setTimeout(() => window.location.replace("login.html"), 900);
  } catch (error) {
    button.disabled = false;
    button.textContent = error.message || "Tentar novamente";
  }
});