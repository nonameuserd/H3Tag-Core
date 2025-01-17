export enum NetworkErrorCode {
  INVALID_PROPAGATION_TIME = "INVALID_PROPAGATION_TIME",
  INVALID_HASH_RATE = "INVALID_HASH_RATE",
  PEER_CONNECTION_FAILED = "PEER_CONNECTION_FAILED",
  PEER_TIMEOUT = "PEER_TIMEOUT",
  PEER_VALIDATION_FAILED = "PEER_VALIDATION_FAILED",
  MESSAGE_VALIDATION_FAILED = "MESSAGE_VALIDATION_FAILED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  PROTOCOL_VERSION_MISMATCH = "PROTOCOL_VERSION_MISMATCH",
  NETWORK_UNREACHABLE = "NETWORK_UNREACHABLE",
  INVALID_MESSAGE_FORMAT = "INVALID_MESSAGE_FORMAT",
  TAG_TRANSFER_FAILED = "TAG_TRANSFER_FAILED",
  TAG_INSUFFICIENT_BALANCE = "TAG_INSUFFICIENT_BALANCE",
  TAG_INVALID_AMOUNT = "TAG_INVALID_AMOUNT",
  TAG_SYNC_ERROR = "TAG_SYNC_ERROR",
  TAG_TRANSACTION_REJECTED = "TAG_TRANSACTION_REJECTED",
  METRICS_UPDATE_FAILED = "METRICS_UPDATE_FAILED",
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  NETWORK_DISCONNECTED = "NETWORK_DISCONNECTED",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  PEER_BANNED = "PEER_BANNED",
  PEER_NOT_FOUND = "PEER_NOT_FOUND",
  NETWORK_INFO_FAILED = "NETWORK_INFO_FAILED",
}

export class NetworkError extends Error {
  public readonly timestamp: number;
  public readonly details?: Record<string, unknown>;
  public readonly code: NetworkErrorCode;

  constructor(
    message: string,
    code: NetworkErrorCode,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "NetworkError";
    this.code = code;
    this.timestamp = Date.now();
    this.details = details ? { ...details } : undefined;

    Object.setPrototypeOf(this, NetworkError.prototype);

    Error.captureStackTrace(this, NetworkError);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      details: this.details ? { ...this.details } : undefined,
      stack: this.sanitizeStack(this.stack),
    };
  }

  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;
    return process.env.NODE_ENV === "development"
      ? stack
      : stack.split("\n")[0];
  }
}
