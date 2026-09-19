const { Schema, model, Types } = require("mongoose");

const paymentSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    roundId: { type: Types.ObjectId, ref: "Round", required: true, index: true },
    quantity: { type: Number, required: true, min: 1, max: 100 },
    ticketIds: [{ type: Types.ObjectId, ref: "Ticket" }],
    amountCents: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "approved", "expired", "refused"],
      default: "pending",
      index: true,
    },
    gateway: { type: String, default: "mercadopago" },
    gatewayPaymentId: { type: String, default: undefined, index: { unique: true, sparse: true } },
    qrText: { type: String, default: null },
    qrBase64: { type: String, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
    webhookEventId: { type: String, default: undefined, index: { unique: true, sparse: true } },
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

module.exports = model("Payment", paymentSchema);
