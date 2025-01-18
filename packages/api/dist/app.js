"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const apply_1 = require("./middleware/apply");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
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
const swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
// Apply middleware
(0, apply_1.applyMiddleware)(app);
// Swagger UI setup
app.use("/api-docs", swagger_ui_express_1.default.serve);
app.get("/api-docs", swagger_ui_express_1.default.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "H3TAG Blockchain Node API Documentation",
}));
// API Documentation JSON endpoint
app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});
// Routes
app.use("/api/v1", routes_1.default);
exports.default = app;
