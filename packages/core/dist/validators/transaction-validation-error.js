"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionValidationError = void 0;
const constants_1 = require("../blockchain/utils/constants");
class TransactionValidationError extends Error {
    constructor(message, code) {
        super(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL}: ${message}`);
        this.code = code;
        this.name = "TransactionValidationError";
    }
}
exports.TransactionValidationError = TransactionValidationError;
