const { Schema, model, Types } = require("mongoose");

const ticketCounterSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    roundId: { type: Types.ObjectId, ref: "Round", required: true },
    nextNumber: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

ticketCounterSchema.index({ userId: 1, roundId: 1 }, { unique: true });

module.exports = model("TicketCounter", ticketCounterSchema);
