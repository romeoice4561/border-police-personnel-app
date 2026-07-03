/**
 * Rank index (Phase 11A): Rank -> officers with that rank.
 *
 * Pure function over the officer set; no globals, no I/O.
 */

import type { KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";

/** Builds a map from rank (trimmed, non-empty) to the officers holding it. */
export function buildRankIndex(officers: KnowledgeOfficer[]): Map<string, KnowledgeOfficer[]> {
  const index = new Map<string, KnowledgeOfficer[]>();

  for (const officer of officers) {
    const rank = officer.identity.rank.trim();
    if (rank.length === 0) continue;

    const bucket = index.get(rank);
    if (bucket) {
      bucket.push(officer);
    } else {
      index.set(rank, [officer]);
    }
  }

  return index;
}
