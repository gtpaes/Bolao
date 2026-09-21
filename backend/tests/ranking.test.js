/* Escolha da rodada anterior exibida na página de Ranking (scoringService).

   A seção não pode nascer vazia só porque a rodada imediatamente anterior não teve
   apostas: por isso a escolha ignora rodadas sem tickets com palpites. */

const test = require("node:test");
const assert = require("node:assert/strict");
const { pickPreviousRound } = require("../src/services/scoringService");

const rounds = (...pairs) => pairs.map(([number, tickets]) => ({ number, tickets }));

test("usa a rodada anterior mais recente que tenha apostas", () => {
  assert.equal(pickPreviousRound(rounds([28, 0], [27, 5], [26, 3]), 29).number, 27);
});

test("sem nenhuma rodada com apostas, cai na imediatamente anterior", () => {
  assert.equal(pickPreviousRound(rounds([28, 0], [27, 0]), 29).number, 28);
});

test("ignora a própria rodada e rodadas futuras", () => {
  const list = rounds([29, 9], [30, 4], [28, 2]);
  assert.equal(pickPreviousRound(list, 29).number, 28);
});

test("sem rodada anterior devolve null", () => {
  assert.equal(pickPreviousRound(rounds([29, 1]), 29), null);
  assert.equal(pickPreviousRound([], 29), null);
  assert.equal(pickPreviousRound(null, 29), null);
});