const config = require("../../config/env");
const logger = require("../../config/logger");
const Round = require("../../models/Round");
const { listRounds, getRoundDetail } = require("./client");

// Converte "30/05/2026" + "16:00" (ou ISO) em Date.
// Retorna null quando a API-Futebol ainda não divulgou a data (jogo "a definir"):
// inventar a data de agora corrompe a data da rodada e o auto-fechamento.
function toDate(item) {
  if (item.data_realizacao_iso) {
    const d = new Date(item.data_realizacao_iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (item.data_realizacao && item.hora_realizacao) {
    const [dd, mm, yyyy] = String(item.data_realizacao).split("/").map(Number);
    const [hh, mi] = String(item.hora_realizacao).split(":").map(Number);
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
    const d = new Date(yyyy, mm - 1, dd, hh || 0, mi || 0);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

// A API-Futebol usa "agendado", "andamento", "finalizado", "adiado", "cancelado".
// (Antes "finalizado" caía no default e TODO jogo encerrado virava "scheduled",
// o que impedia a pontuação e permitia palpites em jogo já terminado.)
function mapStatus(apiStatus) {
  const s = String(apiStatus || "").toLowerCase().trim();
  if (!s) return "scheduled";
  if (["andamento", "live", "em_andamento", "em andamento"].includes(s)) return "live";
  if (["finalizado", "finalizada", "encerrado", "encerrada", "finished"].includes(s)) return "finished";
  if (["adiado", "adiada", "postponed"].includes(s)) return "postponed";
  if (["cancelado", "cancelada", "cancelled", "canceled"].includes(s)) return "cancelled";
  return "scheduled";
}

function mapMatch(item) {
  const home = item.time_mandante || {};
  const away = item.time_visitante || {};
  const status = mapStatus(item.status);
  return {
    externalId: Number(item.partida_id),
    home: home.nome_popular || home.nome || "Mandante",
    away: away.nome_popular || away.nome || "Visitante",
    homeShort: home.sigla || "",
    awayShort: away.sigla || "",
    homeCrest: home.escudo || "",
    awayCrest: away.escudo || "",
    startsAt: toDate(item),
    status,
    homeScore: item.placar_mandante != null ? Number(item.placar_mandante) : null,
    awayScore: item.placar_visitante != null ? Number(item.placar_visitante) : null,
    penalty: Boolean(item.disputa_penalti && item.disputa_penalti !== false),
    stadium: (item.estadio && item.estadio.nome_popular) || "",
  };
}

function extractMatches(detail) {
  if (Array.isArray(detail)) return detail;
  if (detail && Array.isArray(detail.partidas)) return detail.partidas;
  if (detail && Array.isArray(detail.jogos)) return detail.jogos;
  if (detail && Array.isArray(detail.matches)) return detail.matches;
  return [];
}

function pickTargetRound(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const normalizedStatus = (round) => String(round.status || "").toLowerCase().trim();
  const numberOf = (round) => Number(round.rodada);
  const ordered = list
    .filter((round) => Number.isFinite(numberOf(round)))
    .sort((a, b) => numberOf(a) - numberOf(b));
  if (!ordered.length) return null;

  // A API pode devolver as rodadas em qualquer ordem. Sempre priorize a rodada
  // ao vivo mais recente, sem depender da posição na resposta.
  const live = [...ordered].reverse().find((round) => ["andamento", "ao_vivo", "live"].includes(normalizedStatus(round)));
  if (live) return live;

  const finishedStatuses = ["encerrada", "encerrado", "finalizada", "finalizado", "finished"];
  const lastFinished = [...ordered].reverse().find((round) => finishedStatuses.includes(normalizedStatus(round)));

  // Quando disponível, a referência oficial da API é mais confiável que a
  // ordem da lista, especialmente quando existem rodadas adiadas.
  if (lastFinished && lastFinished.proxima_rodada && lastFinished.proxima_rodada.rodada != null) {
    const next = ordered.find((round) => numberOf(round) === Number(lastFinished.proxima_rodada.rodada));
    if (next) return next;
  }

  const lastFinishedNumber = lastFinished ? numberOf(lastFinished) : 0;
  const scheduled = ordered.find((round) =>
    ["agendada", "agendado", "scheduled"].includes(normalizedStatus(round)) && numberOf(round) > lastFinishedNumber,
  );
  if (scheduled) return scheduled;

  return lastFinished || ordered[ordered.length - 1];
}
// Sincroniza a rodada atual (ou a informada) preservando o deadline do admin.
async function resolveRoundNumber(forceNumber) {
  if (forceNumber != null && Number.isFinite(Number(forceNumber)) && Number(forceNumber) > 0) {
    return Number(forceNumber);
  }
  if (config.football.provider === "football-data") {
    try {
      const target = pickTargetRound(await listRounds());
      if (target) return Number(target.rodada);
    } catch (e) {
      logger.warn({ err: String(e && e.message) }, "falha ao descobrir rodada atual");
    }
  }
  const latest = await Round.findOne({ status: { $in: ["open", "closed", "finished"] } })
    .sort({ number: -1 })
    .select({ number: 1 })
    .lean();
  return latest ? Number(latest.number) : config.football.roundNumber;
}

async function syncRound(forceNumber) {
  const roundNumber = await resolveRoundNumber(forceNumber);
  let target = null;
  let detail = null;
  if (Number.isFinite(roundNumber) && roundNumber > 0) {
    detail = await getRoundDetail(config.football.campeonatoId, roundNumber);
    target = detail && Number.isFinite(Number(detail.rodada))
      ? detail
      : { rodada: roundNumber, status: "agendada" };
  } else {
    const list = await listRounds();
    target = pickTargetRound(list);
  }
  if (!target) return { synced: false, reason: "no-round" };

  if (!detail) detail = await getRoundDetail(config.football.campeonatoId, target.rodada);
  const items = extractMatches(detail).map(mapMatch).filter((m) => Number.isFinite(m.externalId));
  if (!items.length) logger.warn({ rodada: target.rodada }, "detalhe da rodada sem jogos mapeáveis");

  const existing = await Round.findOne({ number: Number(target.rodada) });
  const enabledByExternalId = new Map(
    (existing && existing.matches || []).map((match) => [Number(match.externalId), match.enabledForTickets !== false]),
  );
  for (const match of items) {
    match.enabledForTickets = enabledByExternalId.has(Number(match.externalId))
      ? enabledByExternalId.get(Number(match.externalId))
      : true;
  }
  const prevDeadline = existing ? existing.deadline : null;
  const prevStatus = existing ? existing.status : null;
  const finishedCount = items.filter((m) => m.status === "finished").length;
  const providerStatus = String(target.status || "").toLowerCase();
  const autoStatus = finishedCount && finishedCount === items.length ? "finished" : providerStatus === "encerrada" ? "finished" : "open";

  const doc = await Round.findOneAndUpdate(
    { number: Number(target.rodada) },
    { $set: { name: target.nome || `${target.rodada}ª Rodada`, slug: target.slug || "", providerStatus: target.status || "", status: prevStatus === "closed" ? "closed" : autoStatus, deadline: prevDeadline, matches: items, source: "api-futebol", syncedAt: new Date() } },
    { upsert: true, new: true }
  );

  // Só considera jogos com data divulgada — jogo sem data não pode fechar a rodada.
  let latestAt = null;
  for (const m of items) {
    if (!m.startsAt) continue;
    const t = new Date(m.startsAt).getTime();
    if (Number.isFinite(t) && (!latestAt || t > latestAt)) latestAt = t;
  }

  let advancedTo = null;
  if (doc.status === "finished" && target.proxima_rodada && target.proxima_rodada.rodada != null) {
    try {
      const nextDetail = await getRoundDetail(config.football.campeonatoId, target.proxima_rodada.rodada);
      const nextItems = extractMatches(nextDetail).map(mapMatch).filter((m) => Number.isFinite(m.externalId));
      const nextExisting = await Round.findOne({ number: Number(target.proxima_rodada.rodada) });
      const nextEnabledByExternalId = new Map(
        (nextExisting && nextExisting.matches || []).map((match) => [Number(match.externalId), match.enabledForTickets !== false]),
      );
      for (const match of nextItems) {
        match.enabledForTickets = nextEnabledByExternalId.has(Number(match.externalId))
          ? nextEnabledByExternalId.get(Number(match.externalId))
          : true;
      }
      if (nextItems.length) {
        await Round.findOneAndUpdate(
          { number: Number(target.proxima_rodada.rodada) },
          { $set: { name: target.proxima_rodada.nome || `${target.proxima_rodada.rodada}ª Rodada`, slug: target.proxima_rodada.slug || "", providerStatus: target.proxima_rodada.status || "agendada", status: "open", matches: nextItems, source: "api-futebol", syncedAt: new Date() }, $setOnInsert: { deadline: null } },
          { upsert: true, new: true }
        );
        advancedTo = Number(target.proxima_rodada.rodada);
      }
    } catch (e) {
      logger.warn({ err: String(e && e.message) }, "falha ao avançar para próxima rodada");
    }
  }
  return { synced: true, round: doc.number, matches: items.length, finished: finishedCount, latestAt, advancedTo };
}

// Aplica o placar ao vivo (filtrado pelo campeonato) nos jogos salvos.
async function applyLive(liveItems) {
  const mine = (liveItems || []).filter((it) => Number(it && it.campeonato && it.campeonato.campeonato_id) === Number(config.football.campeonatoId));
  if (!mine.length) return { updated: 0 };
  const byId = new Map(mine.map((it) => [Number(it.partida_id), it]));
  const rounds = await Round.find({ status: "open", "matches.status": { $in: ["scheduled", "live"] } }).sort({ number: -1 }).limit(3);
  let updated = 0;
  for (const r of rounds) {
    let changed = false;
    for (const m of r.matches) {
      const it = byId.get(Number(m.externalId));
      if (!it) continue;
      m.status = "live";
      if (it.placar_mandante != null) m.homeScore = Number(it.placar_mandante);
      if (it.placar_visitante != null) m.awayScore = Number(it.placar_visitante);
      m.penalty = Boolean(it.disputa_penalti && it.disputa_penalti !== false);
      changed = true;
      updated += 1;
    }
    if (changed) { r.syncedAt = new Date(); await r.save(); }
  }
  return { updated };
}

module.exports = { syncRound, applyLive, pickTargetRound, mapMatch, mapStatus, toDate };