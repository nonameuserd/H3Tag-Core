export declare class BlockValidationError extends Error {
    readonly blockHash?: string;
    readonly validationDetails?: Record<string, unknown>;
    constructor(message: string, blockHash?: string, validationDetails?: Record<string, unknown>);
    toJSON(): {
        name: string;
        message: string;
        blockHash: string;
        validationDetails: Record<string, unknown>;
        stack: string;
    };
}
