const test = require("node:test");
const assert = require("node:assert/strict");
const { pickTargetRound, mapMatch, mapStatus, toDate } = require("../src/integrations/football/sync");
const { toRoundDTO } = require("../src/services/roundService");

test("prefere rodada em andamento", () => {
  const list = [
    { rodada: 1, status: "encerrada" },
    { rodada: 2, status: "andamento" },
    { rodada: 3, status: "agendada" },
  ];
  assert.equal(pickTargetRound(list).rodada, 2);
});

// Caso real (Brasileirão 2026): rodadas antigas adiadas ficam "agendada" na lista
// (ex. rodada 4), enquanto a última encerrada (18) já aponta proxima_rodada = 19.
// A rodada atual deve ser a 19 — a API já informa o avanço — e NÃO a 4.
test("usa proxima_rodada da última encerrada, ignorando outlier antigo agendada", () => {
  const list = [
    { rodada: 17, status: "encerrada", proxima_rodada: { rodada: 18 } },
    { rodada: 4, status: "agendada" },
    { rodada: 18, status: "encerrada", proxima_rodada: { rodada: 19 } },
    { rodada: 19, status: "agendada" },
    { rodada: 20, status: "agendada" },
  ];
  assert.equal(pickTargetRound(list).rodada, 19);
});

test("sem andamento, pega a primeira agendada (fallback quando não há encerrada)", () => {
  const list = [{ rodada: 2, status: "agendada" }];
  assert.equal(pickTargetRound(list).rodada, 2);
});

test("sem proxima_rodada na última encerrada, cai na primeira agendada", () => {
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

// --- Status da API-Futebol -> status interno ---------------------------------
// A API devolve "finalizado"; antes isso caía no default e todo jogo encerrado
// virava "scheduled" (quebrava a pontuação e liberava palpites em jogo encerrado).
test('"finalizado" da API vira "finished"', () => {
  assert.equal(mapStatus("finalizado"), "finished");
  assert.equal(mapStatus("Finalizado"), "finished");
});

test("demais status da API continuam mapeados", () => {
  assert.equal(mapStatus("agendado"), "scheduled");
  assert.equal(mapStatus("andamento"), "live");
  assert.equal(mapStatus("adiado"), "postponed");
  assert.equal(mapStatus("cancelado"), "cancelled");
  assert.equal(mapStatus(""), "scheduled");
});

// --- Data da partida --------------------------------------------------------
// Amostra real da rodada 4: a API devolve data/hora/estádio nulos quando o
// jogo ainda não tem data divulgada.
const partidaSemData = {
  partida_id: 27675,
  status: "agendado",
  placar_mandante: null,
  placar_visitante: null,
  disputa_penalti: false,
  data_realizacao: null,
  hora_realizacao: null,
  data_realizacao_iso: null,
  estadio: null,
  time_mandante: { nome_popular: "Flamengo", sigla: "FLA", escudo: "fla.svg" },
  time_visitante: { nome_popular: "Mirassol", sigla: "MIR", escudo: "mir.svg" },
};

const partidaEncerrada = {
  partida_id: 27600,
  status: "finalizado",
  placar_mandante: 2,
  placar_visitante: 1,
  disputa_penalti: false,
  data_realizacao: "28/01/2026",
  hora_realizacao: "19:00",
  data_realizacao_iso: "2026-01-28T19:00:00-0300",
  estadio: { estadio_id: 831, nome_popular: "Arena MRV" },
  time_mandante: { nome_popular: "Atlético-MG", sigla: "CAM", escudo: "cam.svg" },
  time_visitante: { nome_popular: "Bahia", sigla: "BAH", escudo: "bah.svg" },
};

test("jogo sem data divulgada não inventa a data de agora", () => {
  const m = mapMatch(partidaSemData);
  assert.equal(m.startsAt, null);
  assert.equal(m.status, "scheduled");
  assert.equal(m.home, "Flamengo");
  assert.equal(m.stadium, "");
});

test("toDate devolve null sem data e converte quando existe", () => {
  assert.equal(toDate({}), null);
  assert.equal(toDate(partidaSemData), null);
  assert.equal(toDate(partidaEncerrada).toISOString(), "2026-01-28T22:00:00.000Z");
});

test("jogo encerrado chega com placar e estádio", () => {
  const m = mapMatch(partidaEncerrada);
  assert.equal(m.status, "finished");
  assert.equal(m.homeScore, 2);
  assert.equal(m.awayScore, 1);
  assert.equal(m.stadium, "Arena MRV");
});

// --- DTO da rodada ----------------------------------------------------------
test("data da rodada ignora jogo sem data e usa a mais cedo", () => {
  const round = {
    _id: "abc",
    number: 4,
    status: "open",
    matches: [
      { externalId: 1, startsAt: null },
      { externalId: 2, startsAt: new Date("2026-02-26T22:00:00.000Z") },
      { externalId: 3, startsAt: new Date("2026-02-10T21:30:00.000Z") },
    ],
  };
  assert.equal(toRoundDTO(round).date.toISOString(), "2026-02-10T21:30:00.000Z");
});

test("rodada sem nenhum jogo com data devolve date null", () => {
  const round = { _id: "abc", number: 4, status: "open", matches: [{ externalId: 1, startsAt: null }] };
  assert.equal(toRoundDTO(round).date, null);
});

// O frontend deixou de recalcular a regra: o DTO entrega o instante real de
// fechamento (1º jogo − 2h) e a trava já resolvida em can_pick.
test("DTO expõe closes_at e can_pick resolvidos pelo servidor", () => {
  const first = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const round = {
    _id: "abc",
    number: 4,
    status: "open",
    deadline: null,
    matches: [{ externalId: 3, startsAt: first }],
  };
  const dto = toRoundDTO(round);
  assert.equal(dto.closes_at.getTime(), first.getTime() - 2 * 60 * 60 * 1000);
  assert.equal(dto.can_pick, true);
  assert.equal(dto.manual_override, false);
});

test("DTO marca can_pick=false quando a janela já venceu", () => {
  const round = {
    _id: "abc",
    number: 4,
    status: "open",
    deadline: null,
    matches: [{ externalId: 3, startsAt: new Date(Date.now() - 1000) }],
  };
  assert.equal(toRoundDTO(round).can_pick, false);
});

test("DTO sem data e sem deadline não fecha sozinho (closes_at null)", () => {
  const round = { _id: "abc", number: 4, status: "open", deadline: null, matches: [{ externalId: 3, startsAt: null }] };
  const dto = toRoundDTO(round);
  assert.equal(dto.closes_at, null);
  assert.equal(dto.can_pick, true);
});