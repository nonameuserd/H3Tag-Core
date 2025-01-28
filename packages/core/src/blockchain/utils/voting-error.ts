export type VotingErrorCode =
  | 'INIT_FAILED'
  | 'NETWORK_UNSTABLE'
  | 'NO_ACTIVE_PERIOD'
  | 'INACTIVE_PERIOD'
  | 'OUTSIDE_WINDOW'
  | 'INVALID_VOTE_TYPE'
  | 'VOTE_TOO_LARGE'
  | 'INSUFFICIENT_POW'
  | 'START_PERIOD_FAILED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INVALID_CHAIN_ID'
  | 'INVALID_ADDRESS'
  | 'RETRIEVAL_FAILED'
  | 'INVALID_VOTE'
  | 'STORE_FAILED'
  | 'DUPLICATE_VOTE'
  | 'RECORD_FAILED'
  | 'CLOSE_FAILED'
  | 'INVALID_PERIOD'
  | 'INVALID_VOTER'
  | 'COMMIT_FAILED'
  | 'ROLLBACK_FAILED';

export class VotingError extends Error {
  constructor(
    public readonly code: VotingErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'VotingError';
    Object.setPrototypeOf(this, VotingError.prototype);
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
