import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Logger, StatusCodes } from "@h3tag-blockchain/shared";

// Rate limiting configuration
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
});

// Error handling middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Logger.error("Unhandled error:", err);
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};

// Request logging middleware
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  res.on("finish", () => {
    Logger.info(
      `${req.method} ${req.url} ${res.statusCode} - ${Date.now() - start}ms`
    );
  });
  next();
};

// API key validation middleware
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.header("X-API-Key");
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      error: "Invalid or missing API key",
    });
  }
  next();
};

// CORS configuration
export const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  maxAge: 86400, // 24 hours
};

// Security headers middleware (using helmet)
export const securityHeaders = helmet({
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
export const bodyLimit = {
  json: { limit: "10mb" },
  urlencoded: { limit: "10mb", extended: true },
};

// Timeout middleware
export const timeout = (req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(30000, () => {
    res.status(StatusCodes.REQUEST_TIMEOUT).json({
      error: "Request timeout",
    });
  });
  next();
};
