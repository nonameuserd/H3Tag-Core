export declare class BlockValidationError extends Error {
    readonly blockHash?: string;
    readonly validationDetails?: Record<string, any>;
    constructor(message: string, blockHash?: string, validationDetails?: Record<string, any>);
    toJSON(): {
        name: string;
        message: string;
        blockHash: string;
        validationDetails: Record<string, any>;
        stack: string;
    };
}
