const { getRanking, getPreviousRanking } = require("../services/scoringService");

// Posição do usuário dentro de um ranking (null quando ele não tem ticket ali).
function positionOf(ranking, userId) {
  const idx = (ranking || []).findIndex((row) => String(row.user_id) === String(userId));
  return idx >= 0 ? idx + 1 : null;
}

// A página de Ranking tem duas seções: a rodada atual e a rodada anterior.
// `myPosition` é resolvido para as duas — cada rodada tem a sua posição.
async function ranking(req, res, next) {
  try {
    const data = await getRanking(req.query.round);
    const previous = await getPreviousRanking(data.round ? data.round.id : null);
    data.previous = { round: previous.round, ranking: previous.ranking, myPosition: null };
    if (req.user) {
      data.myPosition = positionOf(data.ranking, req.user.id);
      data.previous.myPosition = positionOf(previous.ranking, req.user.id);
    }
    return res.json(data);
  } catch (e) { return next(e); }
}

module.exports = { ranking };