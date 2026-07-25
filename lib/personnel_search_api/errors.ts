/**
 * Personnel Search API error codes (Phase 51.1).
 */
export const PERSONNEL_SEARCH_API_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_REQUEST",
  "QUERY_TOO_LONG",
  "INVALID_DISCLOSURE_LEVEL",
  "OUT_OF_SCOPE",
  "RATE_LIMITED",
  "SEARCH_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type PersonnelSearchApiErrorCode = (typeof PERSONNEL_SEARCH_API_ERROR_CODES)[number];

export class PersonnelSearchApiError extends Error {
  readonly code: PersonnelSearchApiErrorCode;
  readonly field?: string;
  readonly httpStatus: number;

  constructor(code: PersonnelSearchApiErrorCode, message: string, httpStatus: number, field?: string) {
    super(message);
    this.name = "PersonnelSearchApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.field = field;
  }
}

export function httpStatusForPersonnelSearchError(code: PersonnelSearchApiErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
    case "OUT_OF_SCOPE":
      return 403;
    case "INVALID_REQUEST":
    case "QUERY_TOO_LONG":
    case "INVALID_DISCLOSURE_LEVEL":
      return 400;
    case "RATE_LIMITED":
      return 429;
    case "SEARCH_UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
}
