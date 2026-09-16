const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const config = require("./config/env");
const { errorHandler } = require("./middlewares/errorHandler");
const apiRoutes = require("./routes/api");
const swaggerSpec = require("./docs/swagger");

const path = require("path");
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.frontendOrigins, credentials: false }));
  app.use(express.json({ limit: "512kb" }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }));

  // Frontend estático (deploy dev em localhost, mesma origem da API).
  app.use(express.static(FRONTEND_DIR, { index: false }));
  app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "login.html")));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/api", apiRoutes);
  app.use((req, res) => res.status(404).json({
    timestamp: new Date().toISOString(), status: 404, error: "NOT_FOUND", message: "Rota não encontrada.", path: req.originalUrl,
  }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
