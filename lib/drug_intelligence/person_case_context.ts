/**
 * Person Profile current-case / investigation-origin context (C-INTEL).
 *
 * Canonical investigation context is `?sourceCaseId=` only.
 * Legacy `?caseId=` is accepted solely for backward compatibility when
 * `sourceCaseId` is absent — UI resolution always prefers sourceCaseId and
 * never treats the two params as competing origins.
 * Origin is never inferred from returnTo, never persisted, and never used
 * as a redirect target. Invalid / unrelated values fail closed into
 * aggregate mode.
 */

/** @deprecated Legacy alias — prefer PERSON_SOURCE_CASE_PARAM for new writers. */
export const PERSON_CASE_CONTEXT_PARAM = "caseId";
/** Canonical investigation-origin query param. */
export const PERSON_SOURCE_CASE_PARAM = "sourceCaseId";

const CASE_CONTEXT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/** Accepts only a Drug* application id shape (UUID). Rejects paths, URLs, and query-like values. */
export function sanitizePersonCaseContextId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!CASE_CONTEXT_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/**
 * MODE A when the param is a real DrugCase this person is linked to.
 * MODE B (aggregate) when absent, malformed, stale, or unrelated.
 */
export function resolvePersonProfileCaseContext(
  rawCaseId: string | null | undefined,
  linkedCaseIds: readonly string[],
): string | null {
  const caseId = sanitizePersonCaseContextId(rawCaseId);
  if (!caseId) return null;
  return linkedCaseIds.includes(caseId) ? caseId : null;
}

/**
 * Reads investigation origin from URL.
 * Canonical: `sourceCaseId`. Legacy fallback: `caseId` only if sourceCaseId absent.
 * Does not invent an origin when neither is present.
 */
export function readPersonCaseContextParam(searchParams: { get(name: string): string | null }): string | null {
  return (
    sanitizePersonCaseContextId(searchParams.get(PERSON_SOURCE_CASE_PARAM)) ??
    sanitizePersonCaseContextId(searchParams.get(PERSON_CASE_CONTEXT_PARAM))
  );
}

/**
 * Append investigation origin onto a path.
 * Writes canonical `sourceCaseId` first; keeps legacy `caseId` for compatibility.
 */
export function withPersonSourceCase(path: string, sourceCaseId: string | null | undefined): string {
  const id = sanitizePersonCaseContextId(sourceCaseId);
  if (!id) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${PERSON_SOURCE_CASE_PARAM}=${encodeURIComponent(id)}&${PERSON_CASE_CONTEXT_PARAM}=${encodeURIComponent(id)}`;
}
