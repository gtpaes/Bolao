const { Schema, model, Types } = require("mongoose");

const pickSchema = new Schema(
  {
    matchExternalId: { type: Number, required: true },
    home: { type: Number, required: true, min: 0, max: 99 },
    away: { type: Number, required: true, min: 0, max: 99 },
    points: { type: Number, default: 0 },
  },
  { _id: false }
);

const ticketSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    roundId: { type: Types.ObjectId, ref: "Round", required: true, index: true },
    number: { type: Number, required: true },
    unitPriceCents: { type: Number, required: true, default: 1000 },
    status: {
      type: String,
      enum: ["waiting_payment", "released", "closed", "scored"],
      default: "waiting_payment",
      index: true,
    },
    picks: { type: [pickSchema], default: [] },
    points: { type: Number, default: 0 },
    paymentId: { type: Types.ObjectId, ref: "Payment", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

ticketSchema.index({ userId: 1, roundId: 1, number: 1 }, { unique: true });

module.exports = model("Ticket", ticketSchema);
