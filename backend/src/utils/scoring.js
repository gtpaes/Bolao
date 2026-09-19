// Pontuação oficial do bolão: 10 / 6 / 4 / 0
const POINTS = { exact: 10, draw: 6, winner: 4, miss: 0 };

function outcome(home, away) {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function scorePick(predictedHome, predictedAway, actualHome, actualAway, rules = POINTS) {
  if (predictedHome === actualHome && predictedAway === actualAway) return Number(rules.exact ?? POINTS.exact);
  const predicted = outcome(predictedHome, predictedAway);
  const actual = outcome(actualHome, actualAway);
  if (predicted !== actual) return Number(rules.miss ?? POINTS.miss);
  if (actual === "draw") return Number(rules.draw ?? POINTS.draw);
  return Number(rules.winner ?? POINTS.winner);
}

module.exports = { POINTS, outcome, scorePick };
