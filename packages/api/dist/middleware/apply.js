"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMiddleware = void 0;
const express_1 = __importDefault(require("express"));
const index_1 = require("./index");
const cors_1 = __importDefault(require("cors"));
const applyMiddleware = (app) => {
    // Basic middleware
    app.use(express_1.default.json(index_1.bodyLimit.json));
    app.use(express_1.default.urlencoded(index_1.bodyLimit.urlencoded));
    app.use((0, cors_1.default)(index_1.corsOptions));
    // Security middleware
    app.use(index_1.securityHeaders);
    app.use(index_1.rateLimiter);
    // Custom middleware
    app.use(index_1.requestLogger);
    app.use(index_1.timeout);
    // Protected routes middleware
    app.use("/api/v1/admin/*", index_1.apiKeyAuth);
    // Error handling (should be last)
    app.use(index_1.errorHandler);
};
exports.applyMiddleware = applyMiddleware;
