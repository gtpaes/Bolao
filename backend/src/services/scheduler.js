const cron = require("node-cron");
const config = require("../config/env");
const logger = require("../config/logger");
const { syncRound, applyLive } = require("../integrations/football/sync");
const { listLive } = require("../integrations/football/client");
const { processRoundScoring } = require("../services/scoringService");
const Round = require("../models/Round");
const Settings = require("../models/Settings");

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
      if (res && res.round != null) {
        const round = await Round.findOne({ number: res.round });
        if (round) await processRoundScoring(round._id);
        // Fecha duas horas antes do primeiro jogo da rodada.
        const syncedRound = await Round.findOne({ number: res.round });
        const firstStart = syncedRound && (syncedRound.matches || []).reduce((earliest, match) => {
          if (!match.startsAt) return earliest;
          const value = new Date(match.startsAt).getTime();
          return Number.isFinite(value) && (earliest == null || value < earliest) ? value : earliest;
        }, null);
        const settings = await Settings.findOne({ key: "default" }).lean();
        if ((!settings || settings.autoClose !== false) && firstStart && Date.now() >= firstStart - 2 * 60 * 60 * 1000) {
          const r = await Round.findOne({ number: res.round });
          if (r && r.status === "open") {
            r.status = "closed";
            await r.save();
            logger.info({ round: r.number }, "rodada fechada automaticamente");
          }
        }
      }
    } catch (e) {
      logger.warn({ err: String(e && e.message) }, "falha no sync da rodada");
    }
  });

  // Ao vivo: polling inteligente que só consulta a API quando há algo relevante.
  // O intervalo efetivo e de 10 minutos por padrao para preservar a cota diaria.
  let liveTimer = null;

  async function shouldPollLive(round) {
    if (!round || !round.matches || !round.matches.length) return false;

    const now = new Date();
    const nowMs = now.getTime();

    // Se houver algum jogo com status "live", consulta no proximo ciclo longo.
    if (round.matches.some((m) => m && m.status === "live")) return true;

    // Se houver algum jogo agendado a começar em breve (< 15 min), também deve
    // monitorar para capturar a transição para "live".
    const matchDurationMs = (config.football.matchDurationMinutes || 130) * 60 * 1000;
    const preLiveWindowMs = 15 * 60 * 1000; // 15 minutos antes do início
    const liveWindowMs = matchDurationMs + 5 * 60 * 1000; // prolonga um pouco após o fim

    for (const m of round.matches) {
      if (!m || !m.startsAt) continue;
      const startMs = new Date(m.startsAt).getTime();
      if (!Number.isFinite(startMs)) continue;
      // Jogo terminado há mais de 5 min? ignora
      if (m.status === "finished" && nowMs > startMs + liveWindowMs) continue;
      // Jogo com início em até 15 min ou já começou
      if (startMs - nowMs <= preLiveWindowMs || startMs <= nowMs) return true;
    }

    return false;
  }

  async function getNextPollDelay(round) {
    // Se tem algo para monitorar agora, mantém intervalo curto.
    if (await shouldPollLive(round)) {
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

  async function livePollLoop() {
    // Retorna a rodada aberta se houver jogos relevantes, ou null caso contrário.
    const round = await Round.findOne({ status: "open" }).lean();
    if (!round || !round.matches || !round.matches.length) return null;

    const now = new Date();
    const nowMs = now.getTime();
    const matchDurationMs = (config.football.matchDurationMinutes || 130) * 60 * 1000;
    const preLiveWindowMs = 15 * 60 * 1000;

    for (const m of round.matches) {
      if (!m || !m.startsAt) continue;
      const startMs = new Date(m.startsAt).getTime();
      if (!Number.isFinite(startMs)) continue;
      // Jogo live, ou a começar em até 15 min, ou terminado há menos de 5 min
      const finishedRecently = m.status === "finished" && nowMs <= startMs + matchDurationMs + 5 * 60 * 1000;
      if (m.status === "live" || startMs - nowMs <= preLiveWindowMs || startMs <= nowMs || finishedRecently) {
        return round;
      }
    }

    return null;
  }

  const tick = async () => {
    try {
      const round = await livePollLoop();
      if (!round) {
        // Nenhuma rodada aberta ou sem jogos relevantes
        liveTimer = setTimeout(tick, 15 * 60 * 1000);
        return;
      }

      if (await shouldPollLive(round)) {
        const items = await listLive();
        const res = await applyLive(items);
        if (res.updated) logger.debug(res, "placares ao vivo atualizados");
      }

      // Calcula próximo intervalo baseado no estado atual
      const delayMs = await getNextPollDelay(round);
      liveTimer = setTimeout(tick, delayMs);
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
}

module.exports = { startJobs };
