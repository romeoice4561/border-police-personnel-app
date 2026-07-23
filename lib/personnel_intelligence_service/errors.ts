/**
 * Typed errors for the Personnel Intelligence Service (Phase 49.5).
 * Pure — no I/O. API adapters map these to HTTP status + jsonError codes.
 */

export type PersonnelIntelligenceErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_QUERY"
  | "INVALID_SCOPE"
  | "OFFICER_NOT_FOUND"
  | "DATA_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class PersonnelIntelligenceError extends Error {
  readonly code: PersonnelIntelligenceErrorCode;
  readonly details?: unknown;

  constructor(code: PersonnelIntelligenceErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "PersonnelIntelligenceError";
    this.code = code;
    this.details = details;
  }
}

export function isPersonnelIntelligenceError(error: unknown): error is PersonnelIntelligenceError {
  return error instanceof PersonnelIntelligenceError;
}

/** HTTP status for a service error code (API adapter use). */
export function httpStatusForIntelligenceError(code: PersonnelIntelligenceErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
    case "INVALID_SCOPE":
      return 403;
    case "INVALID_QUERY":
      return 400;
    case "OFFICER_NOT_FOUND":
      return 404;
    case "DATA_UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
}
