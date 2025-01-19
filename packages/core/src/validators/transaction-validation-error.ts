import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';

export class TransactionValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(`${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL}: ${message}`);
    this.name = 'TransactionValidationError';
  }
}
