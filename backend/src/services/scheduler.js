const cron = require("node-cron");
const config = require("../config/env");
const logger = require("../config/logger");
const { syncRound, applyLive, reconcilePendingRounds } = require("../integrations/football/sync");
const { listLive } = require("../integrations/football/client");
const { scoreFinishedRounds } = require("../services/scoringService");
const { autoCloseIfDue, closesAt } = require("./roundLifecycle");
const Round = require("../models/Round");
const Settings = require("../models/Settings");

// setTimeout não deve dormir semanas; acima disso o timer acorda e re-avalia.
const MAX_TIMER_MS = 6 * 60 * 60 * 1000;
let closeTimer = null;

// O admin pode desligar o fechamento automático em Configurações.
async function autoCloseEnabled() {
  const settings = await Settings.findOne({ key: "default" }).lean();
  return !settings || settings.autoClose !== false;
}

// Agenda o fechamento da rodada aberta para o INSTANTE exato (1º jogo − 2h).
// É o complemento do cron de 30 min: o cron cobre reinícios e atrasos, o timer
// garante a precisão. Rodadas com manualOverride são ignoradas.
async function armCloseTimer() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  if (!(await autoCloseEnabled())) return;

  const round = await Round.findOne({ status: "open" }).sort({ number: -1 });
  if (!round || round.manualOverride) return;
  const target = closesAt(round);
  if (target == null) return; // jogo ainda "a definir": sem alvo para agendar

  const delay = target - Date.now();
  if (delay <= 0) {
    const res = await autoCloseIfDue(round);
    if (res.closed) {
      logger.info({ round: round.number, ticketsUpdated: res.ticketsUpdated },
        "rodada fechada automaticamente (2h antes do 1º jogo)");
    }
    return armCloseTimer(); // estado mudou: avalia a próxima rodada aberta
  }

  closeTimer = setTimeout(async () => {
    try {
      const current = await Round.findOne({ status: "open" }).sort({ number: -1 });
      const res = await autoCloseIfDue(current);
      if (res.closed) {
        logger.info({ round: res.round && res.round.number, ticketsUpdated: res.ticketsUpdated },
          "rodada fechada automaticamente (2h antes do 1º jogo)");
      }
    } catch (e) {
      logger.warn({ err: String(e && e.message) }, "falha no fechamento agendado");
    }
    await armCloseTimer();
  }, Math.min(delay, MAX_TIMER_MS));
  logger.info({ round: round.number, inSeconds: Math.round(Math.min(delay, MAX_TIMER_MS) / 1000) }, "fechamento da rodada agendado");
}

function startJobs() {
  // Local e produção compartilham o mesmo Atlas: apenas UM ambiente roda os jobs
  // (evita consumir a cota da API-Futebol em dobro e processar em paralelo).
  if (!config.enableSchedulers) {
    logger.info("jobs desativados (ENABLE_SCHEDULERS=false) — use POST /api/admin/sync/round para sincronizar manualmente");
    return;
  }
  // Sync da rodada a cada N minutos.
  cron.schedule(`*/${config.football.roundPollMinutes} * * * *`, async () => {
    try {
      const res = await syncRound();
      logger.info(res, "sync rodada");
      // Rodadas anteriores ainda com jogo em andamento/vencido não estão no radar
      // do syncRound: sem isto elas ficam congeladas e sem pontuação.
      await reconcilePendingRounds().catch((e) => logger.warn({ err: String(e && e.message) }, "falha ao reconciliar rodadas pendentes"));
      // Pontua toda rodada com jogo finalizado (idempotente por ScoreLog).
      await scoreFinishedRounds();
      if (res && res.round != null) {
        const round = await Round.findOne({ number: res.round });
        // Rede de segurança do fechamento automático: o timer abaixo fecha no
        // instante exato (1º jogo − 2h); isto cobre reinício do processo.
        if (await autoCloseEnabled()) {
          const closedRes = await autoCloseIfDue(round);
          if (closedRes.closed) {
            logger.info({ round: round.number, ticketsUpdated: closedRes.ticketsUpdated },
              "rodada fechada automaticamente (2h antes do 1º jogo)");
          }
        }
      }
      // A data do 1º jogo pode ter mudado neste sync: reagenda o instante exato.
      await armCloseTimer();
    } catch (e) {
      logger.warn({ err: String(e && e.message) }, "falha no sync da rodada");
    }
  });

  // Ao vivo: polling inteligente que só consulta a API quando há algo relevante.
  // O intervalo efetivo e de 10 minutos por padrao para preservar a cota diaria.
  let liveTimer = null;

  // Há algo para monitorar nesta rodada? Jogo ao vivo, prestes a começar (ou
  // recém-terminado). Dado velho demais (mais que a duração de um jogo) não
  // justifica polling rápido — quem reconcilia esse resto é o cron de 30 min.
  function hasRelevantMatch(round) {
    if (!round || !round.matches || !round.matches.length) return false;

    const nowMs = Date.now();
    const matchDurationMs = (config.football.matchDurationMinutes || 130) * 60 * 1000;
    const preLiveWindowMs = 15 * 60 * 1000; // 15 minutos antes do início
    const postLiveWindowMs = matchDurationMs + 5 * 60 * 1000; // prolonga um pouco após o fim

    // Ao vivo sem data divulgada continua sendo motivo para consultar.
    if (round.matches.some((m) => m && m.status === "live" && !m.startsAt)) return true;

    for (const m of round.matches) {
      if (!m || !m.startsAt) continue;
      const startMs = new Date(m.startsAt).getTime();
      if (!Number.isFinite(startMs)) continue;
      if (m.status === "live") {
        if (nowMs - startMs <= postLiveWindowMs) return true;
        continue;
      }
      // Jogo que deveria ter começado há mais tempo que um jogo inteiro já saiu
      // do radar do polling curto.
      if (nowMs > startMs + postLiveWindowMs) continue;
      // Começa em até 15 min ou já começou: captura a transição para "live".
      return true;
    }

    return false;
  }

  async function getNextPollDelay(round) {
    // Se tem algo para monitorar agora, mantém intervalo curto.
    if (hasRelevantMatch(round)) {
      // Nunca consultar mais frequentemente que o piso configurado (5 min).
      return config.football.livePollSeconds * 1000;
    }

    // Sem nada a monitorar: calcula quando é o próximo jogo relevante.
    const matchDurationMs = (config.football.matchDurationMinutes || 130) * 60 * 1000;
    let nextRelevantStart = null;

    for (const m of round.matches) {
      if (!m || !m.startsAt) continue;
      const startMs = new Date(m.startsAt).getTime();
      if (!Number.isFinite(startMs)) continue;
      // Considera apenas jogos que ainda não começaram ou que terminaram há pouco
      const isRelevant =
        startMs > Date.now() ||
        (m.status !== "finished" && startMs > Date.now() - matchDurationMs);
      if (isRelevant && (nextRelevantStart == null || startMs < nextRelevantStart)) {
        nextRelevantStart = startMs;
      }
    }

    if (nextRelevantStart != null) {
      // Polling começará 15 min antes do início do próximo jogo relevante
      const pollStart = nextRelevantStart - 15 * 60 * 1000;
      const delayMs = pollStart - Date.now();
      if (delayMs > 0) {
        return Math.max(config.football.livePollSeconds * 1000, delayMs);
      }
    }

    // Sem jogos futuros conhecidos: retorna ao intervalo normal mas com um
    // limite para não ficar muito tempo sem verificar (ex: novo jogo pode ser
    // adicionado pelo syncRound).
    return 15 * 60 * 1000; // 15 minutos sem jogos relevantes
  }

  // Rodadas com jogo relevante para monitorar — não só a de maior número. Antes,
  // quando a rodada seguinte nascia, a anterior com jogos em andamento saía do
  // radar e ficava presa em "ao vivo" com o placar antigo.
  // Inclui "closed": depois do fechamento (2h antes do 1º jogo) os placares ao
  // vivo continuam sendo atualizados — só os palpites param.
  async function roundsToWatch() {
    const rounds = await Round.find({
      status: { $in: ["open", "closed"] },
      "matches.status": { $in: ["live", "scheduled"] },
    }).sort({ number: -1 }).limit(5).lean();
    return rounds.filter((round) => hasRelevantMatch(round));
  }

  const tick = async () => {
    try {
      const rounds = await roundsToWatch();
      if (!rounds.length) {
        // Nenhuma rodada com jogo relevante
        liveTimer = setTimeout(tick, 15 * 60 * 1000);
        return;
      }

      const items = await listLive();
      // applyLive já reconcilia quem saiu da lista ao vivo (jogo encerrado).
      const res = await applyLive(items);
      if (res.updated || res.reconciled) logger.debug(res, "placares atualizados");
      // Placar fechado neste ciclo? Pontua na hora — é isto que dá ponto ao palpite.
      if (res.reconciled) await scoreFinishedRounds();

      // Próximo intervalo pelo estado mais urgente entre as rodadas monitoradas.
      const delays = await Promise.all(rounds.map((round) => getNextPollDelay(round)));
      liveTimer = setTimeout(tick, Math.min(...delays));
    } catch (e) {
      logger.warn({ err: String(e && e.message) }, "falha no polling de ao vivo");
      // Em caso de erro, aguarda para não gastar a cota em tentativas seguidas.
      if (liveTimer) {
        clearInterval(liveTimer);
      }
      liveTimer = setTimeout(tick, 15 * 60 * 1000);
    }
  };

  // Inicia o timer de polling ao vivo
  liveTimer = setTimeout(tick, 15 * 60 * 1000);
  logger.info({ livePollSeconds: config.football.livePollSeconds }, "jobs agendados");

  // Fechamento no instante exato: agenda já no boot (cobre reinício do processo,
  // quando o cron de 30 min ainda não rodou e o timer foi perdido).
  armCloseTimer().catch((e) => logger.warn({ err: String(e && e.message) }, "falha ao agendar o fechamento da rodada"));
}

module.exports = { startJobs };
