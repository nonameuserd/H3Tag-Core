export declare class TransactionValidationError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
