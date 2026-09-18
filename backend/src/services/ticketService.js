const Ticket = require("../models/Ticket");
const Round = require("../models/Round");
const Payment = require("../models/Payment");
const Pick = require("../models/Pick");
const { badRequest, forbidden, notFound, paymentRequired } = require("../utils/errors");
const { newIdempotencyKey } = require("../utils/idempotency");

const UNIT_PRICE_CENTS = 1000;

function isRoundClosedForPicks(round) {
  if (!round) return true;
  if (round.status !== "open") return true;
  if (round.deadline && new Date(round.deadline).getTime() <= Date.now()) return true;
  return false;
}

function toTicketDTO(t, round) {
  const o = typeof t.toObject === "function" ? t.toObject() : t;
  return {
    id: String(o._id),
    number: o.number,
    round_label: round ? `Rodada ${round.number}` : "—",
    status: o.status === "released" ? "released" : o.status === "waiting_payment" ? "waiting_payment" : o.status,
    picks_count: (o.picks || []).length,
    points: o.points || 0,
    acquired_at: o.createdAt,
  };
}

async function currentOpenRoundOrThrow() {
  const round = await Round.findOne({ status: "open" }).sort({ number: -1 });
  if (!round) throw badRequest("Nenhuma rodada aberta no momento.");
  return round;
}

async function listMyTickets(userId) {
  const tickets = await Ticket.find({ userId }).sort({ createdAt: -1 }).lean();
  const roundIds = [...new Set(tickets.map((t) => String(t.roundId)))];
  const rounds = await Round.find({ _id: { $in: roundIds } }).lean();
  const byId = new Map(rounds.map((r) => [String(r._id), r]));
  return tickets.map((t) => toTicketDTO(t, byId.get(String(t.roundId))));
}

async function getMyTicket(userId, ticketId) {
  const t = await Ticket.findById(ticketId).lean();
  if (!t || String(t.userId) !== String(userId)) throw notFound("Ticket não encontrado.");
  const round = await Round.findById(t.roundId).lean();
  const dto = toTicketDTO(t, round);
  dto.picks = t.picks || [];
  return dto;
}

// Cria N tickets (1 doc por ticket) + 1 cobrança pendente. Valor recalculado no servidor.
async function buyTickets(userId, quantity) {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 100) throw badRequest("Quantidade inválida.");
  const round = await currentOpenRoundOrThrow();
  const totalCents = qty * UNIT_PRICE_CENTS;

  const last = await Ticket.find({ userId, roundId: round._id }).sort({ number: -1 }).limit(1).lean();
  const startNumber = last.length ? last[0].number + 1 : 1;

  const docs = [];
  for (let i = 0; i < qty; i += 1) {
    docs.push({
      userId,
      roundId: round._id,
      number: startNumber + i,
      unitPriceCents: UNIT_PRICE_CENTS,
      status: "waiting_payment",
      picks: [],
      points: 0,
    });
  }
  const created = await Ticket.insertMany(docs, { ordered: true });
  const payment = await Payment.create({
    userId,
    ticketIds: created.map((t) => t._id),
    amountCents: totalCents,
    status: "pending",
    idempotencyKey: newIdempotencyKey("tickets"),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  for (const t of created) {
    await Ticket.updateOne({ _id: t._id }, { $set: { paymentId: payment._id } });
  }
  return {
    tickets: created.map((t) => toTicketDTO(t.toObject ? t.toObject() : t, round.toObject ? round.toObject() : round)),
    payment: { id: String(payment._id), amountCents: totalCents, status: payment.status },
  };
}

// Salva palpites com trava real de fechamento (deadline + status + jogo iniciado).
async function savePicks(userId, ticketId, picks) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket || String(ticket.userId) !== String(userId)) throw notFound("Ticket não encontrado.");
  if (ticket.status !== "released") throw paymentRequired("Ticket ainda não liberado para palpites.");
  const round = await Round.findById(ticket.roundId);
  if (!round) throw notFound("Rodada não encontrada.");
  if (isRoundClosedForPicks(round)) {
    const err = forbidden("Os palpites desta rodada foram encerrados.", "ROUND_CLOSED");
    throw err;
  }
  if (!Array.isArray(picks) || !picks.length) throw badRequest("Informe os palpites.");
  const byExternal = new Map((round.matches || []).map((m) => [Number(m.externalId), m]));
  const normalized = [];
  for (const p of picks) {
    const extId = Number(p.matchId);
    const m = byExternal.get(extId);
    if (!m || m.enabledForTickets === false) throw badRequest("Jogo não selecionado para esta rodada.");
    if (m.status !== "scheduled") {
      const err = forbidden("Este jogo já começou e não aceita mais palpites.", "MATCH_STARTED");
      throw err;
    }
    const home = Number(p.home);
    const away = Number(p.away);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || home > 99 || away < 0 || away > 99) {
      throw badRequest("Placar inválido.");
    }
    normalized.push({ matchExternalId: extId, home, away, points: 0 });
  }
  ticket.picks = normalized;
  await ticket.save();
  await Pick.deleteMany({ ticketId: ticket._id });
  if (normalized.length) {
    await Pick.insertMany(normalized.map((pick) => ({
      ticketId: ticket._id,
      userId: ticket.userId,
      roundId: ticket.roundId,
      matchExternalId: pick.matchExternalId,
      home: pick.home,
      away: pick.away,
      points: 0,
    })), { ordered: true });
  }
  return toTicketDTO(ticket.toObject(), round.toObject());
}

async function listPublicPicks(roundId) {
  const round = roundId
    ? await Round.findById(roundId).lean()
    : await Round.findOne({}).sort({ number: -1 }).lean();
  if (!round) return { round: null, tickets: [] };

  const tickets = await Ticket.find({
    roundId: round._id,
    status: { $in: ["released", "closed", "scored"] },
    "picks.0": { $exists: true },
  }).populate("userId", "username").sort({ number: 1 }).lean();
  const persisted = await Pick.find({ roundId: round._id }).sort({ ticketId: 1, matchExternalId: 1 }).lean();
  const matchesById = new Map((round.matches || []).map((match) => [Number(match.externalId), match]));
  const byTicket = new Map();

  for (const ticket of tickets) {
    byTicket.set(String(ticket._id), {
      ticket_id: String(ticket._id),
      ticket_number: ticket.number,
      username: ticket.userId && ticket.userId.username ? ticket.userId.username : "Usuário",
      points: Number(ticket.points) || 0,
      picks: [],
    });
  }
  for (const pick of persisted) {
    const entry = byTicket.get(String(pick.ticketId));
    if (entry) {
      const match = matchesById.get(Number(pick.matchExternalId));
      entry.picks.push({
        match_id: pick.matchExternalId,
        home_team: match ? match.home : "Mandante",
        away_team: match ? match.away : "Visitante",
        home: pick.home,
        away: pick.away,
        points: pick.points || 0,
      });
    }
  }
  for (const ticket of tickets) {
    const entry = byTicket.get(String(ticket._id));
    if (entry && !entry.picks.length) entry.picks = (ticket.picks || []).map((pick) => ({
      match_id: pick.matchExternalId,
      home_team: matchesById.get(Number(pick.matchExternalId))?.home || "Mandante",
      away_team: matchesById.get(Number(pick.matchExternalId))?.away || "Visitante",
      home: pick.home,
      away: pick.away,
      points: pick.points || 0,
    }));
  }
  return {
    round: { id: String(round._id), number: round.number, name: round.name || "" },
    tickets: [...byTicket.values()],
  };
}

module.exports = { listMyTickets, getMyTicket, buyTickets, savePicks, listPublicPicks, isRoundClosedForPicks, UNIT_PRICE_CENTS };
