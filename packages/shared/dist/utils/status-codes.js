"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusMessages = exports.StatusCodes = void 0;
exports.StatusCodes = {
    // Success responses
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    // Client error responses
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    REQUEST_TIMEOUT: 408,
    // Server error responses
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    SERVICE_UNAVAILABLE: 503,
};
exports.StatusMessages = {
    [exports.StatusCodes.OK]: "Success",
    [exports.StatusCodes.CREATED]: "Resource created successfully",
    [exports.StatusCodes.BAD_REQUEST]: "Invalid request",
    [exports.StatusCodes.NOT_FOUND]: "Resource not found",
    [exports.StatusCodes.INTERNAL_SERVER_ERROR]: "Internal server error",
    [exports.StatusCodes.REQUEST_TIMEOUT]: "Request timeout",
};
