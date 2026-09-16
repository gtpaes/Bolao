/* js/pages/profile.js — Meu Perfil */
import { loadTemplate, run } from "./loader.js";
import { currentProfile } from "../api/auth.js";
import { esc } from "../../utils/dom.js";
import { initials, dateShort } from "../../utils/format.js";
import { openModal } from "../../components/modal.js";
import { toastInfo } from "../../components/toast.js";

export async function render(view) {
  await loadTemplate(view, "profile.html");
  await run(view, async () => {
    const profile = currentProfile() || {};
    const roleLabel = profile.role === "admin" ? "Administrador" : profile.role === "dev" ? "Desenvolvedor" : "Participante";

    const pHost = view.querySelector('[data-host="profile"]');
    pHost.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-5)">
        <span class="avatar avatar-lg">${esc(initials(profile.username))}</span>
        <div>
          <h2 style="font-size:1.3rem">${esc(profile.username || "Usuário")}</h2>
          <span class="badge badge-green">${roleLabel}</span>
        </div>
      </div>
      <div class="divider"></div>
      <div class="li"><span class="li-key">E-mail</span><span class="li-val">${esc(profile.email || "—")}</span></div>
      <div class="li"><span class="li-key">Registrado</span><span class="li-val">${esc(dateShort(profile.createdAt))}</span></div>`;

    const statsHost = view.querySelector('[data-host="stats"]');
    statsHost.innerHTML = `
      <div class="card-header"><h2 class="card-title"><i data-lucide="activity"></i> Estatísticas</h2></div>
      <div class="card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--space-4)">
        ${stat("Tickets", "—")}${stat("Pontos", "—")}${stat("Rodadas", "—")}${stat("Melhor posição", "—")}
      </div>
      <div class="card-footer"><span class="t-small t-muted">Sem dados no momento.</span></div>`;

    view.querySelector('[data-host="edit-trigger"]').addEventListener("click", () => {
      openModal({
        title: "Editar perfil",
        size: "modal-sm",
        body: `<p class="t-muted">A edição de dados está indisponível no momento.</p>`,
        footer: `<button class="btn btn-ghost" data-close>Cancelar</button>`,
      }).overlay.querySelector("[data-close]").onclick = (e) => e.currentTarget.closest(".modal-overlay").remove();
    });
  });
}

function stat(label, value) {
  return `<div class="stat"><span class="stat-value">${esc(value)}</span><span class="stat-label">${esc(label)}</span></div>`;
}