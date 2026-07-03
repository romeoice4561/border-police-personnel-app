/**
 * Career-year index (Phase 11A): Career Year -> officers active in that year.
 *
 * An officer is indexed under every distinct year that appears in their
 * timeline (via the shared `extractTimelineYear`), so a year lookup returns
 * everyone with a career event dated to it. Years that can't be parsed are
 * skipped, never guessed. Pure; no globals, no I/O.
 */

import type { KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";
import { extractTimelineYear } from "@/lib/knowledge/timeline_index";

export function buildCareerYearIndex(officers: KnowledgeOfficer[]): Map<number, KnowledgeOfficer[]> {
  const index = new Map<number, KnowledgeOfficer[]>();

  for (const officer of officers) {
    const years = new Set<number>();
    for (const entry of officer.timeline) {
      const year = extractTimelineYear(entry.year);
      if (year !== null) years.add(year);
    }

    for (const year of years) {
      const bucket = index.get(year);
      if (bucket) {
        bucket.push(officer);
      } else {
        index.set(year, [officer]);
      }
    }
  }

  return index;
}
