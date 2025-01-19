export declare class BlockchainStatsError extends Error {
    readonly code: string;
    readonly context?: Record<string, unknown>;
    constructor(message: string, code: string, context?: Record<string, unknown>);
}
