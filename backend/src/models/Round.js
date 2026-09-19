const { Schema, model } = require("mongoose");

const matchSchema = new Schema(
  {
    externalId: { type: Number, required: true },
    home: { type: String, required: true },
    away: { type: String, required: true },
    homeShort: { type: String, default: "" },
    awayShort: { type: String, default: "" },
    homeCrest: { type: String, default: "" },
    awayCrest: { type: String, default: "" },
    enabledForTickets: { type: Boolean, default: true },
    // null = a API-Futebol ainda não divulgou a data deste jogo ("a definir").
    startsAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["scheduled", "live", "finished", "postponed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    penalty: { type: Boolean, default: false },
    stadium: { type: String, default: "" },
    isManual: { type: Boolean, default: false },
  },
  { _id: false }
);

const roundSchema = new Schema(
  {
    number: { type: Number, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    slug: { type: String, default: "" },
    providerStatus: { type: String, default: "agendada" },
    status: { type: String, enum: ["open", "closed", "finished"], default: "open", index: true },
    deadline: { type: Date, default: null, index: true },
    // Janela estendida para jogos adiados movidos para esta rodada
    extendedDeadline: { type: Date, default: null },
    extendedMatchIds: [{ type: Number }],
    scoringRules: {
      exact: { type: Number, min: 0, default: 10 },
      draw: { type: Number, min: 0, default: 6 },
      winner: { type: Number, min: 0, default: 4 },
      miss: { type: Number, min: 0, default: 0 },
    },
    matches: { type: [matchSchema], default: [] },
    source: { type: String, default: "api-futebol" },
    syncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

roundSchema.index({ status: 1, number: 1 });
roundSchema.index({ "matches.externalId": 1 });
roundSchema.index({ extendedDeadline: 1 });

module.exports = model("Round", roundSchema);
