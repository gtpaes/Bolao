const test = require("node:test");
const assert = require("node:assert/strict");
const { pickTargetRound } = require("../src/integrations/football/sync");

test("prefere rodada em andamento", () => {
  const list = [
    { rodada: 1, status: "encerrada" },
    { rodada: 2, status: "andamento" },
    { rodada: 3, status: "agendada" },
  ];
  assert.equal(pickTargetRound(list).rodada, 2);
});

test("sem andamento, pega a primeira agendada", () => {
  const list = [
    { rodada: 1, status: "encerrada" },
    { rodada: 2, status: "agendada" },
  ];
  assert.equal(pickTargetRound(list).rodada, 2);
});

test("tudo encerrado, pega a última", () => {
  const list = [
    { rodada: 1, status: "encerrada" },
    { rodada: 2, status: "encerrada" },
  ];
  assert.equal(pickTargetRound(list).rodada, 2);
});
