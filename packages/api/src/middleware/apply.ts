import { Express, RequestHandler } from 'express';
import express from 'express';
import {
  rateLimiter,
  errorHandler,
  requestLogger,
  apiKeyAuth,
  corsOptions,
  securityHeaders,
  bodyLimit,
  timeout,
} from './index';
import cors from 'cors';

export const applyMiddleware = (app: Express) => {
  // Basic middleware
  app.use(express.json(bodyLimit.json));
  app.use(express.urlencoded(bodyLimit.urlencoded));
  app.use(cors(corsOptions));

  // Security middleware
  app.use(securityHeaders);
  app.use(rateLimiter() as unknown as RequestHandler);

  // Custom middleware
  app.use(requestLogger);
  app.use(timeout as RequestHandler);

  // Protected routes middleware
  app.use('/api/v1/admin/*', apiKeyAuth as RequestHandler);

  // Error handling (should be last)
  app.use(errorHandler);
};
