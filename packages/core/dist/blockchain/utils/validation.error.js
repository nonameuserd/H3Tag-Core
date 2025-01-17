"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockValidationError = void 0;
class BlockValidationError extends Error {
    constructor(message, blockHash, validationDetails) {
        super(message);
        this.blockHash = blockHash;
        this.validationDetails = validationDetails;
        this.name = 'BlockValidationError';
        Error.captureStackTrace(this, BlockValidationError);
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            blockHash: this.blockHash,
            validationDetails: this.validationDetails,
            stack: this.stack
        };
    }
}
exports.BlockValidationError = BlockValidationError;
//# sourceMappingURL=validation.error.js.map