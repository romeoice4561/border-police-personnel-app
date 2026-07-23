/**
 * Stable error model for the Intelligence Tool execution framework (Phase 49.6).
 * Pure — no I/O. Never attach stack traces or sensitive payloads.
 */

export type IntelligenceToolErrorCode =
  | "TOOL_NOT_FOUND"
  | "INVALID_TOOL_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_SCOPE"
  | "OFFICER_NOT_FOUND"
  | "DATA_UNAVAILABLE"
  | "OUTPUT_VALIDATION_FAILED"
  | "TOOL_EXECUTION_FAILED"
  | "INTERNAL_ERROR";

export class IntelligenceToolError extends Error {
  readonly code: IntelligenceToolErrorCode;
  readonly details?: unknown;

  constructor(code: IntelligenceToolErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "IntelligenceToolError";
    this.code = code;
    this.details = details;
  }
}

export function isIntelligenceToolError(error: unknown): error is IntelligenceToolError {
  return error instanceof IntelligenceToolError;
}
