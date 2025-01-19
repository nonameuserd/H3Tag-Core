export declare class ConsensusError extends Error {
    readonly code?: string;
    readonly details?: Record<string, unknown>;
    constructor(message: string, code?: string, details?: Record<string, unknown>);
    toJSON(): {
        name: string;
        message: string;
        code: string;
        details: Record<string, unknown>;
        stack: string;
    };
}
