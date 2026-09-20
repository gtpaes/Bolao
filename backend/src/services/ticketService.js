const Ticket = require("../models/Ticket");
const Round = require("../models/Round");
const Pick = require("../models/Pick");
const { isRoundOpenForPicks } = require("./roundLifecycle");
const { badRequest, forbidden, notFound, paymentRequired } = require("../utils/errors");

const UNIT_PRICE_CENTS = 1000;

// Fonte única de verdade: services/roundLifecycle.js. Aqui só invertemos o sinal
// para manter a leitura "trava de palpites" já usada nesta camada. Assim o
// bloqueio vale no segundo exato do fechamento, mesmo antes de o status
// "closed" ser persistido pelo timer/cron.
function isRoundClosedForPicks(round) {
  return !isRoundOpenForPicks(round);
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
    payment_id: o.paymentId ? String(o.paymentId) : null,
    // A UI usa isto para não oferecer "Salvar palpites" numa rodada vencida.
    round_status: round ? round.status : null,
    can_pick: Boolean(o.status === "released" && isRoundOpenForPicks(round)),
  };
}

async function listMyTickets(userId) {
  const tickets = await Ticket.find({ userId, status: { $in: ["released", "closed", "scored"] } }).sort({ createdAt: -1 }).lean();
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
  const { createPayment } = require("./paymentService");
  return { payment: await createPayment(userId, quantity) };
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

// Um palpite público precisa carregar três coisas: o que o jogador apostou, o
// resultado real do jogo e os pontos ganhos. Sem o resultado o placar zerado
// ficava sem contexto (parecia que o jogo não tinha sido computado).
function toPublicPick(pick, matchesById) {
  const match = matchesById.get(Number(pick.matchExternalId)) || null;
  const finished = Boolean(match && match.status === "finished" && match.homeScore != null && match.awayScore != null);
  return {
    match_id: pick.matchExternalId,
    home_team: match ? match.home : "Mandante",
    away_team: match ? match.away : "Visitante",
    home: pick.home,
    away: pick.away,
    points: Number(pick.points) || 0,
    match_status: match ? match.status : null,
    finished,
    home_score: finished ? Number(match.homeScore) : null,
    away_score: finished ? Number(match.awayScore) : null,
  };
}

async function listPublicPicks(roundId, ticketId) {
  const round = roundId
    ? await Round.findById(roundId).lean()
    : await Round.findOne({}).sort({ number: -1 }).lean();
  if (!round) return { round: null, tickets: [], visible: false };
  // Enquanto a rodada aceita palpites, os palpites alheios ficam ocultos —
  // inclusive quando ela já venceu no relógio mas o status ainda não foi gravado.
  if (isRoundOpenForPicks(round)) {
    return { round: { id: String(round._id), number: round.number, name: round.name || "" }, tickets: [], visible: false };
  }

  const tickets = await Ticket.find({
    roundId: round._id,
    status: { $in: ["released", "closed", "scored"] },
    "picks.0": { $exists: true },
    ...(ticketId ? { _id: ticketId } : {}),
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
    if (entry) entry.picks.push(toPublicPick(pick, matchesById));
  }
  for (const ticket of tickets) {
    const entry = byTicket.get(String(ticket._id));
    if (entry && !entry.picks.length) {
      entry.picks = (ticket.picks || []).map((pick) => toPublicPick(pick, matchesById));
    }
  }
  for (const entry of byTicket.values()) {
    entry.picks_count = entry.picks.length;
    entry.scored_count = entry.picks.filter((pick) => pick.finished).length;
  }
  return {
    round: { id: String(round._id), number: round.number, name: round.name || "" },
    tickets: [...byTicket.values()],
  };
}

module.exports = { listMyTickets, getMyTicket, buyTickets, savePicks, listPublicPicks, isRoundClosedForPicks, UNIT_PRICE_CENTS };
