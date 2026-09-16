const { getRanking } = require("../services/scoringService");

async function ranking(req, res, next) {
  try {
    const data = await getRanking(req.query.round);
    if (req.user) {
      const idx = data.ranking.findIndex((r) => String(r.user_id) === String(req.user.id));
      data.myPosition = idx >= 0 ? idx + 1 : null;
    }
    return res.json(data);
  } catch (e) { return next(e); }
}

module.exports = { ranking };
