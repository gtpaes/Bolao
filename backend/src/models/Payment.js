const { Schema, model, Types } = require("mongoose");

const paymentSchema = new Schema(
  {
    // Opcional: a venda "em mão" (dinheiro, sem Pix) pode não ter conta.
    userId: { type: Types.ObjectId, ref: "User", required: false, default: null, index: true },
    roundId: { type: Types.ObjectId, ref: "Round", required: true, index: true },
    quantity: { type: Number, required: true, min: 1, max: 100 },
    ticketIds: [{ type: Types.ObjectId, ref: "Ticket" }],
    amountCents: { type: Number, required: true, min: 1 },
    // Líquido efetivamente creditado no MP após a fee do Pix.
    // Preenchido na validação (webhook/getPaymentStatus) quando approved.
    // Fica null para aprovados antes dessa migration -> Receita usa amountCents como fallback.
    netAmountCents: { type: Number, default: null, min: 0 },
    status: {
      type: String,
      enum: ["pending", "approved", "expired", "refused", "cancelled"],
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
    // Observação livre (usado nas vendas em mão para registrar o titular, etc.).
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

module.exports = model("Payment", paymentSchema);
