"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeout = exports.bodyLimit = exports.securityHeaders = exports.corsOptions = exports.apiKeyAuth = exports.requestLogger = exports.errorHandler = exports.rateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const shared_1 = require("@h3tag-blockchain/shared");
// Rate limiting configuration
exports.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later",
});
// Error handling middleware
const errorHandler = (err, req, res, next) => {
    shared_1.Logger.error("Unhandled error:", err);
    res.status(shared_1.StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
};
exports.errorHandler = errorHandler;
// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        shared_1.Logger.info(`${req.method} ${req.url} ${res.statusCode} - ${Date.now() - start}ms`);
    });
    next();
};
exports.requestLogger = requestLogger;
// API key validation middleware
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.header("X-API-Key");
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(shared_1.StatusCodes.UNAUTHORIZED).json({
            error: "Invalid or missing API key",
        });
    }
    next();
};
exports.apiKeyAuth = apiKeyAuth;
// CORS configuration
exports.corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    maxAge: 86400, // 24 hours
};
// Security headers middleware (using helmet)
exports.securityHeaders = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
});
// Request body size limit middleware
exports.bodyLimit = {
    json: { limit: "10mb" },
    urlencoded: { limit: "10mb", extended: true },
};
// Timeout middleware
const timeout = (req, res, next) => {
    res.setTimeout(30000, () => {
        res.status(shared_1.StatusCodes.REQUEST_TIMEOUT).json({
            error: "Request timeout",
        });
    });
    next();
};
exports.timeout = timeout;
//# sourceMappingURL=index.js.map