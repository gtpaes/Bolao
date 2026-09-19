const { listHistory } = require("../services/historyService");

async function list(req, res, next) {
  try {
    return res.json(await listHistory(req.user.id, {
      roundId: req.query.round,
      status: req.query.status,
    }));
  } catch (error) {
    return next(error);
  }
}

module.exports = { list };
