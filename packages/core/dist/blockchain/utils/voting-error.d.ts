export type VotingErrorCode = "INIT_FAILED" | "NETWORK_UNSTABLE" | "NO_ACTIVE_PERIOD" | "INACTIVE_PERIOD" | "OUTSIDE_WINDOW" | "INVALID_VOTE_TYPE" | "VOTE_TOO_LARGE" | "INSUFFICIENT_POW" | "START_PERIOD_FAILED" | "UNAUTHORIZED" | "RATE_LIMITED" | "INVALID_CHAIN_ID" | "INVALID_ADDRESS" | "RETRIEVAL_FAILED" | "INVALID_VOTE" | "STORE_FAILED" | "DUPLICATE_VOTE" | "RECORD_FAILED" | "CLOSE_FAILED";
export declare class VotingError extends Error {
    readonly code: VotingErrorCode;
    readonly details?: Record<string, unknown>;
    constructor(code: VotingErrorCode, message: string, details?: Record<string, unknown>);
    toJSON(): {
        name: string;
        code: VotingErrorCode;
        message: string;
        details: Record<string, unknown>;
    };
}
