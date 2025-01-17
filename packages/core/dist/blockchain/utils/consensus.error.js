"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsensusError = void 0;
class ConsensusError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "ConsensusError";
        Error.captureStackTrace(this, ConsensusError);
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            stack: this.stack,
        };
    }
}
exports.ConsensusError = ConsensusError;
//# sourceMappingURL=consensus.error.js.map