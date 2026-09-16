const cron = require("node-cron");
const config = require("../config/env");
const logger = require("../config/logger");
const { syncRound, applyLive } = require("../integrations/football/sync");
const { listLive } = require("../integrations/football/client");
const { processRoundScoring } = require("../services/scoringService");
const Round = require("../models/Round");

let liveTimer = null;

function startJobs() {
  // Sync da rodada a cada N minutos.
  cron.schedule(`*/${config.football.roundPollMinutes} * * * *`, async () => {
    try {
      const res = await syncRound();
      logger.info(res, "sync rodada");
      if (res && res.round != null) {
        const round = await Round.findOne({ number: res.round });
        if (round) await processRoundScoring(round._id);
        // Fecha palpites automaticamente quando passa do último jogo + margem.
        if (res.latestAt && Date.now() > res.latestAt + config.football.matchDurationMinutes * 60 * 1000) {
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

  // Ao vivo a cada 30s (mínimo permitido pela API), só quando há rodada aberta.
  const tick = async () => {
    try {
      const open = await Round.findOne({ status: "open" }).lean();
      if (!open) return;
      const items = await listLive();
      const res = await applyLive(items);
      if (res.updated) logger.debug(res, "placares ao vivo atualizados");
    } catch (e) {
      logger.warn({ err: String(e && e.message) }, "falha no polling ao vivo");
    }
  };
  liveTimer = setInterval(tick, config.football.livePollSeconds * 1000);
  logger.info("jobs agendados");
}

module.exports = { startJobs };
