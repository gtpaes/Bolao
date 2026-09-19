const Settings = require("../models/Settings");
const Round = require("../models/Round");
const { POINTS } = require("../utils/scoring");

const KEY = "default";

// As regras de pontuação são GLOBAIS: valem para todas as rodadas
// (anteriores, abertas e futuras). Basta editar em Configurações — o valor
// novo passa a valer em tudo, sem precisar salvar rodada por rodada.
function toPoints(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function normalizeRules(points) {
  const p = points || {};
  return {
    exact: toPoints(p.exact, POINTS.exact),
    draw: toPoints(p.draw, POINTS.draw),
    winner: toPoints(p.winner, POINTS.winner),
    miss: toPoints(p.miss, POINTS.miss),
  };
}

function normalizePriceCents(value) {
  if (value === null || value === undefined || value === "") return 1000;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.floor(n)) : 1000;
}

async function getSettings() {
  return Settings.findOneAndUpdate({ key: KEY }, { $setOnInsert: { key: KEY } }, { upsert: true, new: true }).lean();
}

// Regras efetivas usadas pelo cálculo de pontos e pela exibição no site.
async function getScoringRules() {
  const settings = await getSettings();
  return normalizeRules(settings && settings.points);
}

async function updateSettings(body) {
  const input = body || {};
  const settings = await Settings.findOneAndUpdate(
    { key: KEY },
    {
      $set: {
        key: KEY,
        priceCents: normalizePriceCents(input.priceCents),
        autoClose: input.autoClose !== false,
        points: normalizeRules(input.points),
      },
    },
    { upsert: true, new: true }
  );
  // Mantém o snapshot de TODAS as rodadas alinhado com a configuração global
  // (inclusive fechadas e finalizadas), para nenhuma ficar com regra antiga.
  await Round.updateMany({}, { $set: { scoringRules: settings.points } });
  return settings;
}

module.exports = { getSettings, getScoringRules, updateSettings, normalizeRules };