// CORS configuration for bolao backend
// Uses config.frontendOrigins from src/config/env.js
const config = require("./env");

const corsOptions = {
  origin: config.frontendOrigins,
  credentials: false,
};

module.exports = corsOptions;