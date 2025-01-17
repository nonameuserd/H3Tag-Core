"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkError = exports.NetworkErrorCode = void 0;
var NetworkErrorCode;
(function (NetworkErrorCode) {
    NetworkErrorCode["INVALID_PROPAGATION_TIME"] = "INVALID_PROPAGATION_TIME";
    NetworkErrorCode["INVALID_HASH_RATE"] = "INVALID_HASH_RATE";
    NetworkErrorCode["PEER_CONNECTION_FAILED"] = "PEER_CONNECTION_FAILED";
    NetworkErrorCode["PEER_TIMEOUT"] = "PEER_TIMEOUT";
    NetworkErrorCode["PEER_VALIDATION_FAILED"] = "PEER_VALIDATION_FAILED";
    NetworkErrorCode["MESSAGE_VALIDATION_FAILED"] = "MESSAGE_VALIDATION_FAILED";
    NetworkErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    NetworkErrorCode["PROTOCOL_VERSION_MISMATCH"] = "PROTOCOL_VERSION_MISMATCH";
    NetworkErrorCode["NETWORK_UNREACHABLE"] = "NETWORK_UNREACHABLE";
    NetworkErrorCode["INVALID_MESSAGE_FORMAT"] = "INVALID_MESSAGE_FORMAT";
    NetworkErrorCode["TAG_TRANSFER_FAILED"] = "TAG_TRANSFER_FAILED";
    NetworkErrorCode["TAG_INSUFFICIENT_BALANCE"] = "TAG_INSUFFICIENT_BALANCE";
    NetworkErrorCode["TAG_INVALID_AMOUNT"] = "TAG_INVALID_AMOUNT";
    NetworkErrorCode["TAG_SYNC_ERROR"] = "TAG_SYNC_ERROR";
    NetworkErrorCode["TAG_TRANSACTION_REJECTED"] = "TAG_TRANSACTION_REJECTED";
    NetworkErrorCode["METRICS_UPDATE_FAILED"] = "METRICS_UPDATE_FAILED";
    NetworkErrorCode["NETWORK_TIMEOUT"] = "NETWORK_TIMEOUT";
    NetworkErrorCode["NETWORK_DISCONNECTED"] = "NETWORK_DISCONNECTED";
    NetworkErrorCode["INVALID_RESPONSE"] = "INVALID_RESPONSE";
    NetworkErrorCode["PEER_BANNED"] = "PEER_BANNED";
    NetworkErrorCode["PEER_NOT_FOUND"] = "PEER_NOT_FOUND";
    NetworkErrorCode["NETWORK_INFO_FAILED"] = "NETWORK_INFO_FAILED";
})(NetworkErrorCode = exports.NetworkErrorCode || (exports.NetworkErrorCode = {}));
class NetworkError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'NetworkError';
        this.code = code;
        this.timestamp = Date.now();
        this.details = details ? { ...details } : undefined;
        Object.setPrototypeOf(this, NetworkError.prototype);
        Error.captureStackTrace(this, NetworkError);
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            timestamp: this.timestamp,
            details: this.details ? { ...this.details } : undefined,
            stack: this.sanitizeStack(this.stack)
        };
    }
    sanitizeStack(stack) {
        if (!stack)
            return undefined;
        return process.env.NODE_ENV === 'development'
            ? stack
            : stack.split('\n')[0];
    }
}
exports.NetworkError = NetworkError;
//# sourceMappingURL=network-error.js.map