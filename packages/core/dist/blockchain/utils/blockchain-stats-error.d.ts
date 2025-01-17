declare class BlockchainStatsError extends Error {
    readonly code: string;
    readonly context?: Record<string, any>;
    constructor(message: string, code: string, context?: Record<string, any>);
}
