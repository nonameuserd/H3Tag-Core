import express from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { applyMiddleware } from "./middleware/apply";
import routes from "./routes";

const app = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "H3TAG Blockchain Node API",
      version: "1.0.0",
      description: "API for managing blockchain nodes",
      contact: {
        name: "API Support",
        url: "https://h3tag.io/support",
        email: "support@h3tag.io",
      },
      license: {
        name: "Apache 2.0",
        url: "https://www.apache.org/licenses/LICENSE-2.0.html",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "Production server",
      },
      {
        url: "http://localhost:3000/api/v1",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: [
    "./src/routes/*.ts",
    "./src/controllers/*.ts",
    "./src/dtos/*.ts",
    "./src/services/*.ts",
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Apply middleware
applyMiddleware(app);

// Swagger UI setup
app.use("/api-docs", swaggerUi.serve);
app.get(
  "/api-docs",
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "H3TAG Blockchain Node API Documentation",
  })
);

// API Documentation JSON endpoint
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Routes
app.use("/api/v1", routes);

export default app;
