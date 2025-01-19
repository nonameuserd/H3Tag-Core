export declare class DiscoveryError extends Error {
    readonly code?: string;
    constructor(message: string, code?: string);
}
