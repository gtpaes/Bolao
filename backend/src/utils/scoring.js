// Pontuação oficial do bolão: 10 / 6 / 4 / 0
const POINTS = { exact: 10, draw: 6, winner: 4, miss: 0 };

function outcome(home, away) {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function scorePick(predictedHome, predictedAway, actualHome, actualAway) {
  if (predictedHome === actualHome && predictedAway === actualAway) return POINTS.exact;
  const predicted = outcome(predictedHome, predictedAway);
  const actual = outcome(actualHome, actualAway);
  if (predicted !== actual) return POINTS.miss;
  if (actual === "draw") return POINTS.draw;
  return POINTS.winner;
}

module.exports = { POINTS, outcome, scorePick };
