/**
 * Course name normalization (Phase 45, Task 3).
 *
 * `Training.course` is free text (prisma/schema.prisma) — no catalog table,
 * no enum, no course-code FK. This module turns free text into a
 * normalized key CONSERVATIVELY: whitespace/punctuation cleanup plus an
 * explicit, documented alias table. It never uses fuzzy/similarity matching
 * to decide policy-relevant identity — an unmatched name returns
 * `confidence: "unmatched"` and `normalizedCourseKey: null` rather than a
 * guess, per the phase's explicit "exclude rather than guess" rule.
 *
 * Pure — no I/O, no React.
 */

export type CourseMatchConfidence = "exact" | "alias" | "unmatched";

export interface NormalizedCourseName {
  originalName: string;
  normalizedCourseKey: string | null;
  confidence: CourseMatchConfidence;
}

/**
 * Collapses whitespace runs to a single space, trims, and normalizes a
 * handful of Thai punctuation variants that appear interchangeably in
 * free-text data entry (full-width space, repeated dots). Does NOT strip
 * meaningful punctuation like "." in abbreviations (ผกก.) — this is
 * cleanup, not aggressive canonicalization.
 */
function cleanupText(raw: string): string {
  return raw
    .replace(/　/g, " ") // full-width space -> normal space
    .replace(/\.{2,}/g, ".") // repeated dots -> one dot
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A bare structural key: cleaned text, lowercased (for the Latin-script
 * portion; Thai has no case), with internal spaces/dots removed — this is
 * the EXACT-match key, distinct from an alias key below. Two course names
 * that are identical except for spacing/punctuation collapse to the same
 * exact key; two names that merely LOOK similar do not.
 */
function structuralKey(cleaned: string): string {
  return cleaned.toLowerCase().replace(/[\s.]+/g, "");
}

/**
 * Explicit, documented alias map: known alternate spellings/abbreviations
 * of the SAME course, each entry justified by evidence a human curator
 * confirmed refers to the identical course — never inferred automatically.
 * Empty today (no course catalog/policy exists yet to justify any entry —
 * see docs/TRAINING_INTELLIGENCE.md's Known Limitations); the map is wired
 * and tested so a future curator can add entries without touching the
 * matching logic. Keys are structural keys (see structuralKey); values are
 * the canonical normalized course key they resolve to.
 */
export const COURSE_ALIAS_MAP: ReadonlyMap<string, string> = new Map([
  // Example shape for a future curated entry (commented out — not live data):
  // [structuralKey("หลักสูตรผู้กำกับการ"), "COURSE_PHU_KAMKAP_KARN"],
]);

/**
 * Normalizes one free-text course name. Returns `confidence: "exact"` when
 * the cleaned name itself becomes the key (no alias needed — the
 * structural key IS the normalized key), `"alias"` when an explicit,
 * documented alias table entry matched, or `"unmatched"` (normalizedCourseKey
 * null) when the name is blank or cannot be reliably keyed. Never fuzzy —
 * only exact structural equality or a documented alias.
 */
export function normalizeCourseName(rawCourseName: string | null | undefined): NormalizedCourseName {
  const originalName = rawCourseName ?? "";
  const cleaned = cleanupText(originalName);
  if (!cleaned) {
    return { originalName, normalizedCourseKey: null, confidence: "unmatched" };
  }

  const key = structuralKey(cleaned);
  const aliasTarget = COURSE_ALIAS_MAP.get(key);
  if (aliasTarget) {
    return { originalName, normalizedCourseKey: aliasTarget, confidence: "alias" };
  }

  return { originalName, normalizedCourseKey: key, confidence: "exact" };
}
