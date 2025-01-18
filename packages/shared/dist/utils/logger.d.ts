import winston from "winston";
export declare const Logger: winston.Logger;
export declare const requestLogger: (req: any, res: any, next: any) => void;
export declare const performance: {
    start: (label: string) => void;
    end: (label: string) => void;
};
declare const _default: {
    error: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    info: (message: string, meta?: any) => winston.Logger;
    http: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
    performance: {
        start: (label: string) => void;
        end: (label: string) => void;
    };
    requestLogger: (req: any, res: any, next: any) => void;
};
export default _default;
