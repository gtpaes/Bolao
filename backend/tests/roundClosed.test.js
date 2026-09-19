/* Regra única de fechamento (services/roundLifecycle.js).

   Antes existiam três regras divergentes: `round.status` no savePicks, `deadline`
   no frontend e "1º jogo − 2h" no scheduler — o que deixava rodada fechada com
   tickets marcados como liberados. Estes testes fixam a regra única. */

const test = require("node:test");
const assert = require("node:assert/strict");
const { closesAt, firstMatchStart, isRoundOpenForPicks, AUTO_CLOSE_WINDOW_MS } = require("../src/services/roundLifecycle");
const { isRoundClosedForPicks } = require("../src/services/ticketService");

const HOUR = 60 * 60 * 1000;

// --- Compatibilidade: a trava de palpites é o inverso da regra única ---------
test("rodada sem deadline e aberta aceita palpites", () => {
  assert.equal(isRoundClosedForPicks({ status: "open", deadline: null }), false);
});

test("deadline passado fecha palpites", () => {
  assert.equal(isRoundClosedForPicks({ status: "open", deadline: new Date(Date.now() - 1000) }), true);
});

test("status fechado bloqueia mesmo com deadline futuro", () => {
  assert.equal(isRoundClosedForPicks({ status: "closed", deadline: new Date(Date.now() + 3600000) }), true);
});

test("sem rodada bloqueia", () => {
  assert.equal(isRoundClosedForPicks(null), true);
});

// --- Instante de fechamento -------------------------------------------------
test("fecha exatamente 2h antes do 1º jogo", () => {
  const first = new Date("2026-03-01T20:00:00.000Z");
  const round = { status: "open", deadline: null, matches: [{ startsAt: first }] };
  assert.equal(closesAt(round), first.getTime() - AUTO_CLOSE_WINDOW_MS);
  assert.equal(AUTO_CLOSE_WINDOW_MS, 2 * HOUR);
});

test("o jogo mais cedo da rodada manda, não o primeiro da lista", () => {
  const early = new Date("2026-03-01T18:00:00.000Z");
  const round = {
    status: "open",
    deadline: null,
    matches: [
      { startsAt: new Date("2026-03-01T22:00:00.000Z") },
      { startsAt: early },
      { startsAt: null },
    ],
  };
  assert.equal(firstMatchStart(round), early.getTime());
  assert.equal(closesAt(round), early.getTime() - AUTO_CLOSE_WINDOW_MS);
});

test("deadline definido no admin vence a regra automática", () => {
  const deadline = new Date("2026-03-01T10:00:00.000Z");
  const round = { status: "open", deadline, matches: [{ startsAt: new Date("2026-03-01T20:00:00.000Z") }] };
  assert.equal(closesAt(round), deadline.getTime());
});

test("jogo ainda sem data divulgada não fecha a rodada sozinha", () => {
  const round = { status: "open", deadline: null, matches: [{ startsAt: null }, { startsAt: null }] };
  assert.equal(closesAt(round), null);
  assert.equal(isRoundOpenForPicks(round), true);
});

test("rodada sem jogos não fecha sozinha", () => {
  assert.equal(closesAt({ status: "open", deadline: null, matches: [] }), null);
  assert.equal(isRoundOpenForPicks({ status: "open", deadline: null }), true);
});

// --- Exatidão ao segundo ----------------------------------------------------
test("no instante exato do fechamento a rodada já está fechada", () => {
  const round = {
    status: "open",
    deadline: null,
    matches: [{ startsAt: new Date(Date.now() + AUTO_CLOSE_WINDOW_MS) }],
  };
  assert.equal(isRoundClosedForPicks(round), true);
});

test("um segundo antes do fechamento ainda aceita palpites", () => {
  const round = {
    status: "open",
    deadline: null,
    matches: [{ startsAt: new Date(Date.now() + AUTO_CLOSE_WINDOW_MS + 1000) }],
  };
  assert.equal(isRoundClosedForPicks(round), false);
});

// --- Controle manual --------------------------------------------------------
test("controle manual mantém a rodada aberta depois da janela", () => {
  const round = {
    status: "open",
    deadline: null,
    manualOverride: true,
    matches: [{ startsAt: new Date(Date.now() - 6 * HOUR) }],
  };
  assert.equal(isRoundOpenForPicks(round), true);
  assert.equal(isRoundClosedForPicks(round), false);
});

test("controle manual não reabre uma rodada com status closed", () => {
  const round = {
    status: "closed",
    deadline: null,
    manualOverride: true,
    matches: [{ startsAt: new Date(Date.now() + 6 * HOUR) }],
  };
  assert.equal(isRoundOpenForPicks(round), false);
  assert.equal(isRoundClosedForPicks(round), true);
});