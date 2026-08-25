/**
 * Pure comparison helpers for DI-7.5 Person Comparison Intelligence workspace.
 *
 * All functions are pure (no I/O, no React, no side-effects).  They are used
 * by the compare page to classify each field as one of four display states:
 *
 *   MATCH        — values present on both sides and canonically equal
 *   CONFLICT     — values present on both sides but different
 *   MISSING      — absent on one or both sides (no comparison possible)
 *   INFORMATIONAL — present on both sides; not an identity field; useful
 *                   context but NOT treated as identity evidence on its own
 *
 * Thai display labels (Section 22):
 *   ตรงกัน / แตกต่าง / ไม่มีข้อมูล / ข้อมูลประกอบ
 *
 * NEVER infer identity from informational fields alone (Section 6/8).
 * NEVER return a numeric probability.
 */

export type FieldComparisonStatus = "match" | "conflict" | "missing" | "informational";

export interface FieldComparison {
  status: FieldComparisonStatus;
  /** Canonical left value (may be null). */
  left: string | null;
  /** Canonical right value (may be null). */
  right: string | null;
}

// ── Scalar fields ────────────────────────────────────────────────────────────

/**
 * Compare two nullable scalar strings as identity evidence.
 * Both absent → missing.  One absent → missing (cannot compare).
 * Both present and equal → match.  Both present but different → conflict.
 */
export function compareScalar(a: string | null | undefined, b: string | null | undefined): FieldComparison {
  const left = a ?? null;
  const right = b ?? null;
  if (!left && !right) return { status: "missing", left, right };
  if (!left || !right) return { status: "missing", left, right };
  return { status: left === right ? "match" : "conflict", left, right };
}

/**
 * Compare two nullable values as informational context only (sex,
 * nationality, approximate age).  Returns "informational" instead of
 * "conflict" when values differ, since these fields are NOT treated as
 * identity evidence.
 */
export function compareInformational(a: string | null | undefined, b: string | null | undefined): FieldComparison {
  const left = a ?? null;
  const right = b ?? null;
  if (!left && !right) return { status: "missing", left, right };
  if (!left || !right) return { status: "missing", left, right };
  return { status: left === right ? "match" : "informational", left, right };
}

// ── Array / set fields ───────────────────────────────────────────────────────

/**
 * Compare two arrays of canonical scalar values (phone numbers, IMEIs, plates,
 * identifier keys).
 *
 * - Both empty → missing
 * - One empty  → missing (cannot compare)
 * - Any overlap → match
 * - No overlap  → conflict (both sides have values but none coincide)
 */
export function compareArrayOverlap(a: string[], b: string[]): FieldComparison {
  if (a.length === 0 && b.length === 0) return { status: "missing", left: null, right: null };
  if (a.length === 0 || b.length === 0) return { status: "missing", left: a.join(", ") || null, right: b.join(", ") || null };
  const overlap = a.filter((v) => b.includes(v));
  return {
    status: overlap.length > 0 ? "match" : "conflict",
    left: a.join(", "),
    right: b.join(", "),
  };
}

/**
 * Find the shared (intersecting) values between two arrays.
 * Returns an empty array when there is no overlap.
 */
export function arrayIntersection<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((v) => setB.has(v));
}

// ── Identifier-specific comparison ──────────────────────────────────────────

export interface IdentifierEntry {
  type: string;
  value: string;
}

/**
 * Compare identifier sets.
 * Two sets "match" when at least one (type, value) pair is identical on both
 * sides — this is a strong identity signal.
 * Both empty → missing; one empty → missing; otherwise match or conflict.
 */
export function compareIdentifiers(a: IdentifierEntry[], b: IdentifierEntry[]): FieldComparison {
  const keysA = a.map((x) => `${x.type}:${x.value}`);
  const keysB = b.map((x) => `${x.type}:${x.value}`);
  return compareArrayOverlap(keysA, keysB);
}

// ── Shared-entity helpers ────────────────────────────────────────────────────

export interface SharedPhones {
  sharedNumbers: string[];
}
export function findSharedPhones(phonesA: string[], phonesB: string[]): SharedPhones {
  return { sharedNumbers: arrayIntersection(phonesA, phonesB) };
}

export interface SharedImeis {
  sharedImeis: string[];
}
export function findSharedImeis(imeisA: string[], imeisB: string[]): SharedImeis {
  return { sharedImeis: arrayIntersection(imeisA, imeisB) };
}

export interface SharedVehicles {
  sharedRegistrations: string[];
}
export function findSharedVehicles(regsA: string[], regsB: string[]): SharedVehicles {
  return { sharedRegistrations: arrayIntersection(regsA, regsB) };
}

export interface SharedCases {
  sharedCaseIds: string[];
}
export function findSharedCases(caseIdsA: string[], caseIdsB: string[]): SharedCases {
  return { sharedCaseIds: arrayIntersection(caseIdsA, caseIdsB) };
}

export interface SharedNetworkGroups {
  sharedGroupIds: string[];
}
export function findSharedNetworkGroups(groupIdsA: string[], groupIdsB: string[]): SharedNetworkGroups {
  return { sharedGroupIds: arrayIntersection(groupIdsA, groupIdsB) };
}

// ── Identifier overlap helper (for shared entity "เอกสาร overlap") ───────────

/**
 * Returns identifier keys (type:value) shared by both persons.
 */
export function findSharedIdentifierKeys(a: IdentifierEntry[], b: IdentifierEntry[]): string[] {
  const keysB = new Set(b.map((x) => `${x.type}:${x.value}`));
  return a.map((x) => `${x.type}:${x.value}`).filter((k) => keysB.has(k));
}

// ── URL helpers ──────────────────────────────────────────────────────────────

/** Build the compare-page URL for a known pair. */
export function buildCompareUrl(personAId: string, personBId: string): string {
  return `/drug-intelligence/review/duplicates/compare?a=${encodeURIComponent(personAId)}&b=${encodeURIComponent(personBId)}`;
}

/** Build the person profile URL. */
export function buildProfileUrl(personId: string): string {
  return `/drug-intelligence/persons/${encodeURIComponent(personId)}`;
}

/** Build the timeline URL for a single person. */
export function buildTimelineUrl(personId: string): string {
  return `/drug-intelligence/timeline?focusType=PERSON&focusId=${encodeURIComponent(personId)}`;
}

/** Build the network graph URL focused on a person. */
export function buildNetworkUrl(personId: string): string {
  return `/drug-intelligence/network?focusType=PERSON&focusId=${encodeURIComponent(personId)}`;
}
