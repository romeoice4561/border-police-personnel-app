/**
 * Consistent API responses (Phase 13).
 *
 * One place that shapes success and error JSON so every route handler returns
 * the same envelope: `{ data, meta? }` on success, `{ error: { code, message,
 * details? } }` on failure. Pure helpers over the Web Response API — no Next
 * server internals, so they're unit-testable without a running server.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface ApiSuccessBody<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export function jsonOk<T>(data: T, meta?: Record<string, unknown>, status = 200): Response {
  const body: ApiSuccessBody<T> = meta ? { data, meta } : { data };
  return Response.json(body, { status });
}

export function jsonError(code: string, message: string, status: number, details?: unknown): Response {
  const body: ApiErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return Response.json(body, { status });
}

/** 400 for invalid query/params (Zod). */
export function badRequest(message: string, details?: unknown): Response {
  return jsonError("BAD_REQUEST", message, 400, details);
}

/** 404 for a missing resource. */
export function notFound(message: string): Response {
  return jsonError("NOT_FOUND", message, 404);
}

/** 503 when the database/dependency is unavailable. */
export function serviceUnavailable(message: string): Response {
  return jsonError("SERVICE_UNAVAILABLE", message, 503);
}

/** 500 catch-all; never leaks internal error details to the client. */
export function internalError(message = "Internal server error"): Response {
  return jsonError("INTERNAL_ERROR", message, 500);
}
