import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { format } from 'winston';
import { existsSync, mkdirSync } from 'fs';
import { Request, Response, NextFunction } from 'express';

// Ensure logs directory exists
const LOG_DIR = 'logs';
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR);
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
winston.addColors(colors);

// Custom format
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, metadata, stack }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
    if (metadata && typeof metadata === 'object') {
      log += ` ${JSON.stringify(metadata)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  }),
);

// Console format with colors
const consoleFormat = format.combine(format.colorize({ all: true }), logFormat);

// Create the logger
export const Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: logFormat,
  transports: [
    // Console logging
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Error logging
    new DailyRotateFile({
      filename: `${LOG_DIR}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '20m',
      zippedArchive: true,
    }),

    // Combined logging
    new DailyRotateFile({
      filename: `${LOG_DIR}/combined-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
      zippedArchive: true,
    }),
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: `${LOG_DIR}/exceptions-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
      zippedArchive: true,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: `${LOG_DIR}/rejections-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
      zippedArchive: true,
    }),
  ],
});

// Add request logging middleware for Express
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  Logger.http(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    params: req.params,
    query: req.query,
    body: req.body,
  });
  next();
};

// Performance monitoring
export const performance = {
  start: (label: string) => {
    console.time(label);
  },
  end: (label: string) => {
    console.timeEnd(label);
  },
};

// Export a simplified interface
export default {
  error: (message: string, meta?: unknown) => Logger.error(message, meta),
  warn: (message: string, meta?: unknown) => Logger.warn(message, meta),
  info: (message: string, meta?: unknown) => Logger.info(message, meta),
  http: (message: string, meta?: unknown) => Logger.http(message, meta),
  debug: (message: string, meta?: unknown) => Logger.debug(message, meta),
  performance,
  requestLogger,
};
