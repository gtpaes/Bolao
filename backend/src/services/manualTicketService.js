/* services/manualTicketService.js — Vendas "em mão" (dinheiro, sem Pix).

   Uma venda em mão:
   - é criada pelo admin direto, sem passar pelo gateway;
   - vincula (opcionalmente) a uma conta ou guarda só o nome do titular;
   - entra no financeiro como pagamento APROVADO (preço configurado, R$ 10);
   - nasce com os palpites de todos os jogos habilitados da rodada;
   - nasce liberada (released/closed segundo o estado da rodada). */

const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const TicketCounter = require("../models/TicketCounter");
const Round = require("../models/Round");
const User = require("../models/User");
const Payment = require("../models/Payment");
const settingsService = require("./settingsService");
const { isRoundOpenForPicks } = require("./roundLifecycle");
const { newIdempotencyKey } = require("../utils/idempotency");
const { badRequest, notFound, conflict } = require("../utils/errors");

const UNIT_PRICE_CENTS = 1000;

function parseNumber(value, label) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) throw badRequest(`${label} inválido.`);
  return n;
}

function parsePickScore(value, label) {
  const raw = String(value == null ? "" : value).trim();
  if (!/^\d{1,2}$/.test(raw)) throw badRequest(`${label} inválido. Use um número entre 0 e 99.`);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 99) throw badRequest(`${label} inválido. Use um número entre 0 e 99.`);
  return n;
}

// O ticket manual segue a mesma regra do ticket normal: exatamente um palpite
// para cada jogo habilitado na rodada. A validação no servidor impede que uma
// chamada direta à API grave palpites incompletos ou de outro confronto.
function normalizePicks(picks, matches) {
  if (!Array.isArray(picks)) throw badRequest("Informe os palpites do ticket.");
  const eligible = (matches || []).filter((match) => match.enabledForTickets !== false);
  if (!eligible.length) throw badRequest("A rodada não possui jogos habilitados para palpites.");

  const byMatchId = new Map();
  for (const pick of picks) {
    const rawId = pick && pick.matchId != null ? pick.matchId : pick && pick.matchExternalId;
    const matchId = Number(rawId);
    if (!Number.isFinite(matchId)) throw badRequest("Palpite com jogo inválido.");
    if (byMatchId.has(matchId)) throw badRequest("Há palpites repetidos para o mesmo jogo.");
    byMatchId.set(matchId, {
      matchExternalId: matchId,
      home: parsePickScore(pick.home, "Palpite do mandante"),
      away: parsePickScore(pick.away, "Palpite do visitante"),
      points: 0,
    });
  }

  const missing = eligible.filter((match) => !byMatchId.has(Number(match.externalId)));
  if (missing.length) throw badRequest(`Preencha o palpite de todos os jogos da rodada. Faltam ${missing.length}.`);
  const unknown = [...byMatchId.keys()].filter((matchId) => !eligible.some((match) => Number(match.externalId) === matchId));
  if (unknown.length) throw badRequest("A rodada possui palpites de jogos que não estão habilitados.");

  return eligible.map((match) => byMatchId.get(Number(match.externalId)));
}

// Ajusta o contador do usuário registrado para que uma futura compra Pix não
// atribua um número já usado por esta venda em mão.
async function alignCounter(userId, roundId, number, session) {
  const counter = await TicketCounter.findOne({ userId, roundId }).session(session).lean();
  if (!counter) {
    await TicketCounter.create([{ userId, roundId, nextNumber: number }], { session });
    return;
  }
  if ((counter.nextNumber || 0) < number) {
    await TicketCounter.updateOne({ _id: counter._id }, { $set: { nextNumber: number } }, { session });
  }
}

async function resolveNumber({ roundId, userId, requested, session }) {
  if (requested != null && requested !== "") {
    const number = parseNumber(requested, "Número do ticket");
    if (userId) {
      if (await Ticket.exists({ userId, roundId, number }).session(session)) {
        throw conflict("Este titular já tem um ticket com esse número nesta rodada.", "TICKET_NUMBER_TAKEN");
      }
    }
    return number;
  }

  // Auto: próximo disponível.
  if (userId) {
    const last = await Ticket.findOne({ userId, roundId }).sort({ number: -1 }).select("number").session(session).lean();
    return (last && last.number ? last.number : 0) + 1;
  }
  const last = await Ticket.findOne({ roundId, userId: null }).sort({ number: -1 }).select("number").session(session).lean();
  return (last && last.number ? last.number : 0) + 1;
}

// Cria uma venda em mão: um pagamento aprovado (vai ao financeiro) + o ticket
// com todos os palpites da rodada. O preço é SEMPRE o configurado (R$ 10 por
// padrão) — venda em mão não tem flexibilidade.
async function createManualTicket({ roundId, name, number, userId, picks }) {
  if (!roundId || !mongoose.Types.ObjectId.isValid(String(roundId))) throw badRequest("Rodada inválida.");
  const round = await Round.findById(String(roundId));
  if (!round) throw notFound("Rodada não encontrada.");
  const normalizedPicks = normalizePicks(picks, round.matches || []);

  // Resolve o titular: conta (opcional) ou nome livre.
  let resolvedUser = null;
  let ownerName = "";
  if (userId !== null && userId !== undefined && userId !== "") {
    if (!mongoose.Types.ObjectId.isValid(String(userId))) throw badRequest("Usuário inválido.");
    resolvedUser = await User.findById(String(userId));
    if (!resolvedUser) throw notFound("Usuário não encontrado.");
    ownerName = String(name || "").trim() || resolvedUser.username;
  } else {
    ownerName = String(name || "").trim();
    if (!ownerName) throw badRequest("Informe o nome do titular.");
  }

  const settings = await settingsService.getSettings();
  const priceCents = Number(settings.priceCents) > 0 ? Number(settings.priceCents) : UNIT_PRICE_CENTS;
  const ticketStatus = isRoundOpenForPicks(round) ? "released" : "closed";

  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const numberValue = await resolveNumber({
        roundId: round._id,
        userId: resolvedUser ? resolvedUser._id : null,
        requested: number,
        session,
      });

      const [payment] = await Payment.create([{
        ...(resolvedUser ? { userId: resolvedUser._id } : {}),
        roundId: round._id,
        quantity: 1,
        ticketIds: [],
        amountCents: priceCents,
        netAmountCents: priceCents, // em mão não há fee de gateway -> neto = bruto
        status: "approved",
        gateway: "manual",
        idempotencyKey: newIdempotencyKey("manual"),
        note: ownerName,
      }], { session });

      const [ticket] = await Ticket.create([{
        ...(resolvedUser ? { userId: resolvedUser._id } : {}),
        roundId: round._id,
        number: numberValue,
        unitPriceCents: priceCents,
        status: ticketStatus,
        picks: normalizedPicks,
        points: 0,
        paymentId: payment._id,
        ownerName,
        paymentMethod: "manual",
      }], { session });

      payment.ticketIds = [ticket._id];
      await payment.save({ session });
      if (resolvedUser) await alignCounter(resolvedUser._id, round._id, numberValue, session);
      created = { ticket, payment, number: numberValue };
    });
  } finally {
    await session.endSession();
  }

  return {
    ok: true,
    ticket: {
      id: String(created.ticket._id),
      number: created.number,
      owner: ownerName,
      round: round.number,
      roundId: String(round._id),
      status: created.ticket.status,
      priceCents,
      paymentMethod: "manual",
      paymentId: String(created.payment._id),
      picks: normalizedPicks,
    },
  };
}

module.exports = { createManualTicket, normalizePicks, UNIT_PRICE_CENTS };