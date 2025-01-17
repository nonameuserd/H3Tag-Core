"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performance = exports.requestLogger = exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const winston_2 = require("winston");
const fs_1 = require("fs");
// Ensure logs directory exists
const LOG_DIR = 'logs';
if (!(0, fs_1.existsSync)(LOG_DIR)) {
    (0, fs_1.mkdirSync)(LOG_DIR);
}
// Custom log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};
// Add colors to winston
winston_1.default.addColors(colors);
// Custom format
const logFormat = winston_2.format.combine(winston_2.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_2.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }), winston_2.format.errors({ stack: true }), winston_2.format.printf(({ timestamp, level, message, metadata, stack }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
    if (metadata && typeof metadata === 'object') {
        log += ` ${JSON.stringify(metadata)}`;
    }
    if (stack) {
        log += `\n${stack}`;
    }
    return log;
}));
// Console format with colors
const consoleFormat = winston_2.format.combine(winston_2.format.colorize({ all: true }), logFormat);
// Create the logger
exports.Logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels,
    format: logFormat,
    transports: [
        // Console logging
        new winston_1.default.transports.Console({
            format: consoleFormat
        }),
        // Error logging
        new winston_daily_rotate_file_1.default({
            filename: `${LOG_DIR}/error-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxFiles: '30d',
            maxSize: '20m',
            zippedArchive: true
        }),
        // Combined logging
        new winston_daily_rotate_file_1.default({
            filename: `${LOG_DIR}/combined-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d',
            maxSize: '20m',
            zippedArchive: true
        })
    ],
    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
        new winston_daily_rotate_file_1.default({
            filename: `${LOG_DIR}/exceptions-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d',
            maxSize: '20m',
            zippedArchive: true
        })
    ],
    rejectionHandlers: [
        new winston_daily_rotate_file_1.default({
            filename: `${LOG_DIR}/rejections-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d',
            maxSize: '20m',
            zippedArchive: true
        })
    ]
});
// Add request logging middleware for Express
const requestLogger = (req, res, next) => {
    exports.Logger.http(`${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        params: req.params,
        query: req.query,
        body: req.body
    });
    next();
};
exports.requestLogger = requestLogger;
// Performance monitoring
exports.performance = {
    start: (label) => {
        console.time(label);
    },
    end: (label) => {
        console.timeEnd(label);
    }
};
// Export a simplified interface
exports.default = {
    error: (message, meta) => exports.Logger.error(message, meta),
    warn: (message, meta) => exports.Logger.warn(message, meta),
    info: (message, meta) => exports.Logger.info(message, meta),
    http: (message, meta) => exports.Logger.http(message, meta),
    debug: (message, meta) => exports.Logger.debug(message, meta),
    performance: exports.performance,
    requestLogger: exports.requestLogger
};
//# sourceMappingURL=logger.js.map