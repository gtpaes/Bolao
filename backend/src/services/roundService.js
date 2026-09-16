const Round = require("../models/Round");

function toRoundDTO(r) {
  if (!r) return null;
  const o = typeof r.toObject === "function" ? r.toObject() : r;
  return {
    id: String(o._id),
    number: o.number,
    name: o.name,
    slug: o.slug,
    status: o.status,
    providerStatus: o.providerStatus,
    date: o.matches && o.matches.length ? o.matches[0].startsAt : null,
    deadline: o.deadline,
    syncedAt: o.syncedAt,
  };
}

function toMatchDTO(m) {
  const o = typeof m.toObject === "function" ? m.toObject() : m;
  const live = o.status === "live";
  return {
    id: o.externalId != null ? String(o.externalId) : String(o._id || ""),
    externalId: o.externalId,
    home: o.home,
    away: o.away,
    home_crest: o.homeCrest || "",
    away_crest: o.awayCrest || "",
    date: o.startsAt,
    status: o.status,
    live,
    home_score: o.homeScore,
    away_score: o.awayScore,
  };
}

async function getCurrentRound() {
  const round = await Round.findOne({ status: { $in: ["open", "closed"] } }).sort({ number: -1 }).lean();
  if (round) return toRoundDTO(round);
  const latest = await Round.findOne({}).sort({ number: -1 }).lean();
  return toRoundDTO(latest);
}

async function listRounds() {
  const rounds = await Round.find({}).sort({ number: -1 }).lean();
  return rounds.map(toRoundDTO);
}

async function getRound(id) {
  const round = await Round.findById(id).lean();
  return toRoundDTO(round);
}

async function listMatches(roundId) {
  let round = null;
  if (roundId) {
    round = await Round.findById(roundId).lean();
  }
  if (!round) {
    round = await Round.findOne({ status: { $in: ["open", "closed"] } }).sort({ number: -1 }).lean();
  }
  if (!round) return [];
  return (round.matches || []).map(toMatchDTO);
}

async function listLive() {
  const rounds = await Round.find({ status: { $in: ["open", "closed"] }, "matches.status": "live" })
    .sort({ number: -1 })
    .limit(3)
    .lean();
  const out = [];
  for (const r of rounds) {
    for (const m of r.matches || []) {
      if (m.status === "live") out.push(toMatchDTO(m));
    }
  }
  return out;
}

module.exports = { getCurrentRound, listRounds, getRound, listMatches, listLive, toRoundDTO, toMatchDTO };
