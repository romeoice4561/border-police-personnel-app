/**
 * Unit index (Phase 11A): Unit -> officers who served in that unit.
 *
 * An officer is indexed under every distinct unit in their `units` list
 * (identity/top-level unit plus every timeline unit), so a unit lookup
 * returns everyone associated with it. Pure; no globals, no I/O.
 */

import type { KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";

export function buildUnitIndex(officers: KnowledgeOfficer[]): Map<string, KnowledgeOfficer[]> {
  const index = new Map<string, KnowledgeOfficer[]>();

  for (const officer of officers) {
    for (const unit of officer.units) {
      const trimmed = unit.trim();
      if (trimmed.length === 0) continue;

      const bucket = index.get(trimmed);
      if (bucket) {
        // Guard against indexing the same officer twice under one unit.
        if (!bucket.some((o) => o.identity.id === officer.identity.id)) bucket.push(officer);
      } else {
        index.set(trimmed, [officer]);
      }
    }
  }

  return index;
}
