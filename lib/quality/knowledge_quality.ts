/**
 * Knowledge-derived quality signals (Phase 11B).
 *
 * Cross-record quality signals computed from the Phase 11A KnowledgeBase:
 * which officers participate in a duplicate phone / duplicate identity /
 * duplicate timeline group, and a per-officer career-quality score. Read-only
 * over the KnowledgeBase — detection only, never modifies it. Reuses the
 * knowledge layer's own duplicate detection rather than reimplementing it.
 *
 * No globals, no I/O.
 */

import type { KnowledgeBase, KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";
import { detectDuplicates } from "@/lib/knowledge/knowledge_statistics";

/** Sets of officer ids that participate in each kind of duplicate group. */
export interface DuplicateParticipation {
  duplicatePhoneIds: Set<string>;
  duplicateOfficerIds: Set<string>;
  duplicateTimelineIds: Set<string>;
}

/** Builds the duplicate-participation sets once, for O(1) per-officer lookup. */
export function buildDuplicateParticipation(base: KnowledgeBase): DuplicateParticipation {
  const report = detectDuplicates(base);
  const collect = (groups: { officerIds: string[] }[]): Set<string> => {
    const ids = new Set<string>();
    for (const group of groups) for (const id of group.officerIds) ids.add(id);
    return ids;
  };

  return {
    duplicatePhoneIds: collect(report.duplicate_phones),
    duplicateOfficerIds: collect(report.duplicate_officers),
    duplicateTimelineIds: collect(report.duplicate_timeline),
  };
}

/**
 * 0-100 career-quality score from an officer's derived career facts: presence
 * of timeline entries, derivable year span, and served units. An officer with
 * no timeline scores 0; one with entries, a year span, and units scores 100.
 */
export function careerQualityScore(officer: KnowledgeOfficer): number {
  const { timeline_count, first_year, last_year, unit_count } = officer.career;
  if (timeline_count === 0) return 0;

  let score = 0;
  score += 40; // has timeline entries
  if (first_year !== null && last_year !== null) score += 30; // datable career span
  if (unit_count >= 1) score += 20; // at least one identifiable unit
  if (unit_count >= 2) score += 10; // multi-unit career history
  return Math.min(100, score);
}
