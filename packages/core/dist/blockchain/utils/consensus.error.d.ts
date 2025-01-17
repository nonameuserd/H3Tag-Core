export declare class ConsensusError extends Error {
    readonly code?: string;
    readonly details?: Record<string, any>;
    constructor(message: string, code?: string, details?: Record<string, any>);
    toJSON(): {
        name: string;
        message: string;
        code: string;
        details: Record<string, any>;
        stack: string;
    };
}
