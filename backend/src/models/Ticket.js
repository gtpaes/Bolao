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
    // Opcional: um ticket vendido "em mão" (dinheiro, sem Pix) pode não ter conta.
    // Quando null, o titular fica em `ownerName`.
    userId: { type: Types.ObjectId, ref: "User", required: false, default: null, index: true },
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
    // Titular em texto livre para tickets sem conta (venda em mão).
    ownerName: { type: String, trim: true, default: "" },
    // Como foi cobrado: "pix" (gateway) ou "manual" (dinheiro em mão).
    paymentMethod: { type: String, enum: ["pix", "manual"], default: "pix" },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// Unicidade SÓ quando há conta (userId presente): a venda em mão sem conta
// pode repetir número sem colidir com o fluxo Pix de usuários registrados.
ticketSchema.index(
  { userId: 1, roundId: 1, number: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true, $ne: null } } }
);

module.exports = model("Ticket", ticketSchema);
