export declare const StatusCodes: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly ACCEPTED: 202;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly UNPROCESSABLE_ENTITY: 422;
    readonly TOO_MANY_REQUESTS: 429;
    readonly REQUEST_TIMEOUT: 408;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly NOT_IMPLEMENTED: 501;
    readonly SERVICE_UNAVAILABLE: 503;
};
export declare const StatusMessages: {
    readonly 200: "Success";
    readonly 201: "Resource created successfully";
    readonly 400: "Invalid request";
    readonly 404: "Resource not found";
    readonly 500: "Internal server error";
    readonly 408: "Request timeout";
};
