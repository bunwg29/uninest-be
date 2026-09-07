export const SYSTEM_CONSTANTS = {
  DEFAULT_PORT: 3000,
  DEFAULT_API_PREFIX: 'api/v1',
  APP_NAME: 'UniNest API',
  APP_DESCRIPTION: 'Cross-platform Student Housing Mobile App API Service',
  APP_VERSION: '1.0.0',
} as const;

export const USER_ROLES = {
  STUDENT: 'student',
  LANDLORD: 'landlord',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;
