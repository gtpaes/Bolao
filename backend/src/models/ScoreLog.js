const { Schema, model, Types } = require("mongoose");

const scoreLogSchema = new Schema(
  {
    roundId: { type: Types.ObjectId, ref: "Round", required: true, index: true },
    ticketId: { type: Types.ObjectId, ref: "Ticket", required: true, index: true },
    matchExternalId: { type: Number, required: true },
    predicted: {
      home: { type: Number, required: true },
      away: { type: Number, required: true },
    },
    actual: {
      home: { type: Number, required: true },
      away: { type: Number, required: true },
    },
    points: { type: Number, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

scoreLogSchema.index({ ticketId: 1, matchExternalId: 1 }, { unique: true });

module.exports = model("ScoreLog", scoreLogSchema);
