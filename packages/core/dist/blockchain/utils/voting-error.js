"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotingError = void 0;
class VotingError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "VotingError";
        Object.setPrototypeOf(this, VotingError.prototype);
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
        };
    }
}
exports.VotingError = VotingError;
