const mongoose = require("mongoose");
const config = require("./env");
const logger = require("./logger");

async function connectDb() {
  if (!config.mongodbUri) {
    throw new Error("MONGODB_URI não configurada. Copie .env.example para .env e preencha.");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongodbUri, {
    dbName: "bolao",
    serverSelectionTimeoutMS: 15000,
  });
  logger.info("MongoDB conectado");
}

module.exports = { connectDb };
