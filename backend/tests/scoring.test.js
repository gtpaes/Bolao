const test = require("node:test");
const assert = require("node:assert/strict");
const { scorePick, POINTS } = require("../src/utils/scoring");

test("placar exato vale 10", () => {
  assert.equal(scorePick(2, 1, 2, 1), 10);
  assert.equal(POINTS.exact, 10);
});

test("empate correto sem placar vale 6", () => {
  assert.equal(scorePick(0, 0, 1, 1), 6);
  assert.equal(scorePick(2, 2, 0, 0), 6);
});

test("vencedor correto sem placar vale 4", () => {
  assert.equal(scorePick(2, 0, 1, 0), 4);
  assert.equal(scorePick(0, 2, 0, 1), 4);
});

test("erro vale 0", () => {
  assert.equal(scorePick(2, 1, 1, 1), 0);
  assert.equal(scorePick(1, 0, 0, 1), 0);
  assert.equal(scorePick(0, 0, 1, 0), 0);
});