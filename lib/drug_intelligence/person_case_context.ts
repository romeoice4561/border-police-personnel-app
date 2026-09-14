/**
 * Person Profile current-case context (C-INTEL provenance UX).
 *
 * Case context is URL state only (`?caseId=`). It is never inferred from
 * `returnTo`, never persisted, and never used as a redirect target.
 * Invalid / unrelated values fail closed into aggregate mode.
 */

export const PERSON_CASE_CONTEXT_PARAM = "caseId";

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

export function readPersonCaseContextParam(searchParams: { get(name: string): string | null }): string | null {
  return sanitizePersonCaseContextId(searchParams.get(PERSON_CASE_CONTEXT_PARAM));
}
