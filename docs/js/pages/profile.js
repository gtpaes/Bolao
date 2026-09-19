/* js/pages/profile.js — Meu Perfil */
import { loadTemplate, run } from "./loader.js";
import { currentProfile } from "../api/auth.js";
import { getProfileStats, updateProfile, changePassword } from "../api/profile.js";
import { esc } from "../../utils/dom.js";
import { initials, dateShort } from "../../utils/format.js";
import { openModal } from "../../components/modal.js";
import { toastError, toastSuccess } from "../../components/toast.js";

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
    let stats = { tickets: 0, points: 0, rounds: null, bestPosition: null };
    try { stats = (await getProfileStats()).stats || stats; } catch (error) { toastError("Estatísticas indisponíveis", error.message); }
    statsHost.innerHTML = `
      <div class="card-header"><h2 class="card-title"><i data-lucide="activity"></i> Estatísticas</h2></div>
      <div class="card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--space-4)">
        ${stat("Tickets", String(stats.tickets))}${stat("Maior pontuação", String(stats.points))}${stat("Melhor rodada", stats.rounds == null ? "—" : `Rodada ${stats.rounds}`)}${stat("Melhor posição", stats.bestPosition == null ? "—" : `#${stats.bestPosition}`)}
      </div>
      <div class="card-footer"><span class="t-small t-muted">Resumo de todo o bolão.</span></div>`;

    view.querySelector('[data-host="edit-trigger"]').addEventListener("click", () => {
      const modal = openModal({
        title: "Editar perfil",
        size: "modal-sm",
        body: `<div class="field"><label for="profile-username">Nome de usuário</label><input class="input" id="profile-username" value="${esc(profile.username || "")}" minlength="3" maxlength="30"></div><div class="field" style="margin-top:var(--space-3)"><label for="profile-current-password">Senha atual (para trocar senha)</label><input class="input" id="profile-current-password" type="password"></div><div class="field"><label for="profile-new-password">Nova senha</label><input class="input" id="profile-new-password" type="password" minlength="8"></div>`,
        footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-save-profile>Salvar</button>`,
      });
      modal.overlay.querySelector("[data-close]").onclick = () => modal.overlay.remove();
      modal.overlay.querySelector("[data-save-profile]").onclick = async () => {
        const username = modal.overlay.querySelector("#profile-username").value.trim();
        const currentPassword = modal.overlay.querySelector("#profile-current-password").value;
        const newPassword = modal.overlay.querySelector("#profile-new-password").value;
        try {
          const result = await updateProfile(username);
          const profileData = result.user || {};
          localStorage.setItem("bolao.profile", JSON.stringify({ username: profileData.username, email: profileData.email, role: profileData.role, createdAt: profileData.createdAt }));
          if (currentPassword || newPassword) await changePassword(currentPassword, newPassword);
          modal.overlay.remove();
          toastSuccess("Perfil atualizado", "Suas alterações foram salvas.");
          await render(view);
        } catch (error) { toastError("Não foi possível salvar", error.message || "Tente novamente."); }
      };
    });
  });
}

function stat(label, value) {
  return `<div class="stat"><span class="stat-value">${esc(value)}</span><span class="stat-label">${esc(label)}</span></div>`;
}