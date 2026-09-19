const { Schema, model } = require("mongoose");

const settingsSchema = new Schema(
  {
    key: { type: String, unique: true, default: "default" },
    priceCents: { type: Number, min: 1, default: 1000 },
    autoClose: { type: Boolean, default: true },
    points: {
      exact: { type: Number, min: 0, default: 10 },
      draw: { type: Number, min: 0, default: 6 },
      winner: { type: Number, min: 0, default: 4 },
      miss: { type: Number, min: 0, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = model("Settings", settingsSchema);
