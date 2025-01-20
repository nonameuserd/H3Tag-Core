export class BlockValidationError extends Error {
  constructor(
    message: string,
    public readonly blockHash?: string,
    public readonly validationDetails?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BlockValidationError';
    Error.captureStackTrace(this, BlockValidationError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      blockHash: this.blockHash,
      validationDetails: this.validationDetails,
      stack: this.stack,
    };
  }
}
