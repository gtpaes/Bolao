/* services/manualTicketService.js — Vendas "em mão" (dinheiro, sem Pix) e
   lançamento manual de resultados da rodada.

   Uma venda em mão:
   - é criada pelo admin direto, sem passar pelo gateway;
   - vincula (opcionalmente) a uma conta ou guarda só o nome do titular;
   - entra no financeiro como pagamento APROVADO (preço configurado, R$ 10);
   - nasce liberada (released/closed segundo o estado da rodada) para palpitar. */

const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const TicketCounter = require("../models/TicketCounter");
const Round = require("../models/Round");
const User = require("../models/User");
const Payment = require("../models/Payment");
const settingsService = require("./settingsService");
const { isRoundOpenForPicks } = require("./roundLifecycle");
const { processRoundScoring } = require("./scoringService");
const { newIdempotencyKey } = require("../utils/idempotency");
const { badRequest, notFound, conflict } = require("../utils/errors");

const UNIT_PRICE_CENTS = 1000;

function parseNumber(value, label) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) throw badRequest(`${label} inválido.`);
  return n;
}

// Ajusta o contador do usuário registrado para que uma futura compra Pix não
// atribua um número já usado por esta venda em mão.
async function alignCounter(userId, roundId, number) {
  const counter = await TicketCounter.findOne({ userId, roundId }).lean();
  if (!counter) {
    await TicketCounter.create({ userId, roundId, nextNumber: number });
    return;
  }
  if ((counter.nextNumber || 0) < number) {
    await TicketCounter.updateOne({ _id: counter._id }, { $set: { nextNumber: number } });
  }
}

async function resolveNumber({ roundId, userId, requested }) {
  if (requested != null && requested !== "") {
    const number = parseNumber(requested, "Número do ticket");
    if (userId) {
      if (await Ticket.exists({ userId, roundId, number })) {
        throw conflict("Este titular já tem um ticket com esse número nesta rodada.", "TICKET_NUMBER_TAKEN");
      }
    }
    return number;
  }

  // Auto: próximo disponível.
  if (userId) {
    const last = await Ticket.findOne({ userId, roundId }).sort({ number: -1 }).select("number").lean();
    return (last && last.number ? last.number : 0) + 1;
  }
  const last = await Ticket.findOne({ roundId, userId: null }).sort({ number: -1 }).select("number").lean();
  return (last && last.number ? last.number : 0) + 1;
}

function parseIntScore(value, label) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > 99) throw badRequest(`${label} inválido.`);
  return n;
}

// Cria uma venda em mão: um pagamento aprovado (vai ao financeiro) + o ticket liberado.
// O preço é SEMPRE o configurado (R$ 10 por padrão) — venda em mão não tem flexibilidade.
async function createManualTicket({ roundId, name, number, userId }) {
  if (!roundId || !mongoose.Types.ObjectId.isValid(String(roundId))) throw badRequest("Rodada inválida.");
  const round = await Round.findById(String(roundId));
  if (!round) throw notFound("Rodada não encontrada.");

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

  const numberValue = await resolveNumber({
    roundId: round._id,
    userId: resolvedUser ? resolvedUser._id : null,
    requested: number,
  });

  const ticketStatus = isRoundOpenForPicks(round) ? "released" : "closed";

  const payment = await Payment.create({
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
  });

  const ticket = await Ticket.create({
    ...(resolvedUser ? { userId: resolvedUser._id } : {}),
    roundId: round._id,
    number: numberValue,
    unitPriceCents: priceCents,
    status: ticketStatus,
    picks: [],
    points: 0,
    paymentId: payment._id,
    ownerName,
    paymentMethod: "manual",
  });

  payment.ticketIds = [ticket._id];
  await payment.save();

  if (resolvedUser) await alignCounter(resolvedUser._id, round._id, numberValue);

  return {
    ok: true,
    ticket: {
      id: String(ticket._id),
      number: ticket.number,
      owner: ownerName,
      round: round.number,
      roundId: String(round._id),
      status: ticket.status,
      priceCents,
      paymentMethod: "manual",
      paymentId: String(payment._id),
    },
  };
}

// Lança o resultado de um jogo (marca como encerrado) e repontua a rodada na hora.
async function setMatchScore(roundId, matchExternalId, home, away) {
  const round = await Round.findById(roundId);
  if (!round) throw notFound("Rodada não encontrada.");
  const idx = (round.matches || []).findIndex((m) => Number(m.externalId) === Number(matchExternalId));
  if (idx < 0) throw notFound("Jogo não encontrado nesta rodada.");

  const homeScore = parseIntScore(home, "Resultado local");
  const awayScore = parseIntScore(away, "Resultado visitante");

  round.matches[idx].homeScore = homeScore;
  round.matches[idx].awayScore = awayScore;
  round.matches[idx].status = "finished";
  await round.save();

  const processed = await processRoundScoring(round._id);

  return {
    ok: true,
    match: {
      externalId: Number(matchExternalId),
      home: round.matches[idx].home,
      away: round.matches[idx].away,
      home_score: homeScore,
      away_score: awayScore,
      status: "finished",
    },
    processed: processed.processed || 0,
  };
}

module.exports = { createManualTicket, setMatchScore, UNIT_PRICE_CENTS };