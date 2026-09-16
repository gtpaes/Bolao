const test = require("node:test");
const assert = require("node:assert/strict");
const { isRoundClosedForPicks } = require("../src/services/ticketService");

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
