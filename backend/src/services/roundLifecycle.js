/* services/roundLifecycle.js — fonte ÚNICA de verdade sobre "a rodada aceita
   palpites/compra ou não".

   Antes existiam três regras divergentes (round.status no savePicks, deadline no
   frontend e "1º jogo − 2h" no scheduler), o que deixava a rodada fechada com
   tickets marcados como liberados. Agora tudo passa por aqui.

   Regra de fechamento automático: exatamente 2 horas antes do primeiro jogo da
   rodada. O admin pode fechar/reabrir a qualquer momento — nesse caso a rodada
   recebe `manualOverride` e a regra automática deixa de agir sobre ela. */

const Round = require("../models/Round");
const Ticket = require("../models/Ticket");

const AUTO_CLOSE_WINDOW_MS = 2 * 60 * 60 * 1000;

// Menor startsAt entre os jogos HABILITADOS da rodada (jogos sem data são
// ignorados). Jogo desabilitado não pode definir o fechamento: um jogo manual de
// teste com horário antigo já antecipou o fechamento dos palpites em 1 hora.
function firstMatchStart(round) {
  let best = null;
  for (const match of (round && round.matches) || []) {
    if (!match || match.enabledForTickets === false) continue;
    if (!match.startsAt) continue;
    const value = new Date(match.startsAt).getTime();
    if (!Number.isFinite(value)) continue;
    if (best === null || value < best) best = value;
  }
  return best;
}

// Instante de fechamento em ms: um deadline definido no admin vence; senão,
// 1º jogo − 2h. null = nenhuma data divulgada ainda (não fecha sozinha).
function closesAt(round) {
  if (!round) return null;
  if (round.deadline) {
    const explicit = new Date(round.deadline).getTime();
    if (Number.isFinite(explicit)) return explicit;
  }
  const first = firstMatchStart(round);
  return first == null ? null : first - AUTO_CLOSE_WINDOW_MS;
}

// Usada por palpites, compra, DTOs e scheduler. Exata ao milissegundo, mesmo
// antes de o status ser persistido no banco.
function isRoundOpenForPicks(round) {
  if (!round || round.status !== "open") return false;
  if (round.manualOverride) return true; // o admin manda: só ele fecha
  const limit = closesAt(round);
  return limit == null ? true : Date.now() < limit;
}

// Fecha a rodada E marca os tickets (released -> closed). Tickets "scored" não
// são tocados (já têm pontuação).
async function closeRound(roundId, { manual = false } = {}) {
  const round = await Round.findById(roundId);
  if (!round) return { round: null, ticketsUpdated: 0, closed: false };
  if (round.status === "open") {
    round.status = "closed";
    if (manual) round.manualOverride = true;
    await round.save();
  } else if (manual && !round.manualOverride) {
    round.manualOverride = true;
    await round.save();
  }
  const res = await Ticket.updateMany(
    { roundId: round._id, status: "released" },
    { $set: { status: "closed" } }
  );
  return { round, ticketsUpdated: res.modifiedCount || 0, closed: true };
}

// Reabre a rodada E devolve os tickets (closed -> released), liberando palpites
// e novas compras.
async function reopenRound(roundId, { manual = true } = {}) {
  const round = await Round.findById(roundId);
  if (!round) return { round: null, ticketsUpdated: 0, reopened: false };
  round.status = "open";
  if (manual) round.manualOverride = true;
  await round.save();
  const res = await Ticket.updateMany(
    { roundId: round._id, status: "closed" },
    { $set: { status: "released" } }
  );
  return { round, ticketsUpdated: res.modifiedCount || 0, reopened: true };
}

// Devolve a rodada à regra automática (limpa o controle manual).
async function setAutomatic(roundId) {
  const round = await Round.findById(roundId);
  if (!round) return { round: null, automatic: false };
  round.manualOverride = false;
  await round.save();
  return { round, automatic: true };
}

// Aplica a regra automática se a janela já passou. Idempotente: só age em
// rodada aberta, sem controle manual e com data conhecida.
async function autoCloseIfDue(round) {
  if (!round) return { closed: false, reason: "no-round", ticketsUpdated: 0 };
  if (round.status !== "open") return { closed: false, reason: "not-open", ticketsUpdated: 0 };
  if (round.manualOverride) return { closed: false, reason: "manual-override", ticketsUpdated: 0 };
  const limit = closesAt(round);
  if (limit == null) return { closed: false, reason: "no-window", ticketsUpdated: 0 };
  if (Date.now() < limit) return { closed: false, reason: "too-early", ticketsUpdated: 0 };
  const result = await closeRound(round._id, { manual: false });
  return { closed: true, reason: "closed", ticketsUpdated: result.ticketsUpdated };
}

module.exports = {
  AUTO_CLOSE_WINDOW_MS,
  firstMatchStart,
  closesAt,
  isRoundOpenForPicks,
  closeRound,
  reopenRound,
  setAutomatic,
  autoCloseIfDue,
};