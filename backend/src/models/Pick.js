const { Schema, model, Types } = require("mongoose");

const pickSchema = new Schema(
  {
    ticketId: { type: Types.ObjectId, ref: "Ticket", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    roundId: { type: Types.ObjectId, ref: "Round", required: true, index: true },
    matchExternalId: { type: Number, required: true },
    home: { type: Number, required: true, min: 0, max: 99 },
    away: { type: Number, required: true, min: 0, max: 99 },
    points: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

pickSchema.index({ ticketId: 1, matchExternalId: 1 }, { unique: true });
pickSchema.index({ roundId: 1, userId: 1 });

module.exports = model("Pick", pickSchema);
