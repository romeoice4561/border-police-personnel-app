/**
 * Composite index builder (Phase 11A).
 *
 * Assembles every individual index (id/rank/unit/phone/career-year/
 * timeline-year) into a single KnowledgeIndexes structure. Pure composition
 * over the officer set — each sub-index is its own pure function; this module
 * only wires them together. No globals, no I/O.
 */

import type { KnowledgeIndexes, KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";
import { buildRankIndex } from "@/lib/knowledge/rank_index";
import { buildUnitIndex } from "@/lib/knowledge/unit_index";
import { buildPhoneIndex } from "@/lib/knowledge/phone_index";
import { buildCareerYearIndex } from "@/lib/knowledge/career_index";
import { buildTimelineIndex } from "@/lib/knowledge/timeline_index";

/** Builds the officer-id map (id -> officer). */
export function buildIdIndex(officers: KnowledgeOfficer[]): Map<string, KnowledgeOfficer> {
  const index = new Map<string, KnowledgeOfficer>();
  for (const officer of officers) {
    // First writer wins on an id collision; collisions are still surfaced by
    // duplicate detection rather than silently overwriting.
    if (!index.has(officer.identity.id)) index.set(officer.identity.id, officer);
  }
  return index;
}

/** Builds all indexes over the officer set. */
export function buildIndexes(officers: KnowledgeOfficer[]): KnowledgeIndexes {
  return {
    byId: buildIdIndex(officers),
    byRank: buildRankIndex(officers),
    byUnit: buildUnitIndex(officers),
    byPhone: buildPhoneIndex(officers),
    byCareerYear: buildCareerYearIndex(officers),
    byTimelineYear: buildTimelineIndex(officers),
  };
}
