import { Request, Response, NextFunction } from 'express';
export declare const rateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const apiKeyAuth: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const corsOptions: {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
    maxAge: number;
};
export declare const securityHeaders: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const bodyLimit: {
    json: {
        limit: string;
    };
    urlencoded: {
        limit: string;
        extended: boolean;
    };
};
export declare const timeout: (req: Request, res: Response, next: NextFunction) => void;
