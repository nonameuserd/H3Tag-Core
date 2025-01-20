export const StatusCodes = {
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
} as const;

export const StatusMessages = {
  [StatusCodes.OK]: 'Success',
  [StatusCodes.CREATED]: 'Resource created successfully',
  [StatusCodes.BAD_REQUEST]: 'Invalid request',
  [StatusCodes.NOT_FOUND]: 'Resource not found',
  [StatusCodes.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [StatusCodes.REQUEST_TIMEOUT]: 'Request timeout',
} as const;
