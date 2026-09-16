const swaggerJSDoc = require("swagger-jsdoc");

const spec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: { title: "Bolão API", version: "1.0.0", description: "API do Bolão de futebol" },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [],
});

module.exports = spec;
