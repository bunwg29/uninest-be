export const SYSTEM_CONSTANTS = {
  DEFAULT_PORT: 3000,
  DEFAULT_API_PREFIX: 'api/v1',
  APP_NAME: 'UniNest API',
  APP_DESCRIPTION: 'Cross-platform Student Housing Mobile App API Service',
  APP_VERSION: '1.0.0',
} as const;

export enum UserRoleType {
  STUDENT = 0,
  LANDLORD = 1,
  ADMIN = 2,
}

export type UserRole = UserRoleType;

export const USER_ROLES = {
  STUDENT: UserRoleType.STUDENT,
  LANDLORD: UserRoleType.LANDLORD,
  ADMIN: UserRoleType.ADMIN,
} as const;

export const ROLE_NAMES: Record<UserRoleType, string> = {
  [UserRoleType.STUDENT]: 'Sinh viên',
  [UserRoleType.LANDLORD]: 'Chủ trọ',
  [UserRoleType.ADMIN]: 'Quản trị viên',
};

export const ROLE_CODES: Record<UserRoleType, string> = {
  [UserRoleType.STUDENT]: 'STUDENT',
  [UserRoleType.LANDLORD]: 'LANDLORD',
  [UserRoleType.ADMIN]: 'ADMIN',
};

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
