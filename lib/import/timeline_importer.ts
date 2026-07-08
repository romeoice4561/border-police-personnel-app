/**
 * TimelineImporter (Phase 17).
 *
 * Replaces an officer's Timeline rows from the export's normalized timeline —
 * delete every existing row for the officer, then insert the current rows in
 * sequence order, all inside the caller's transaction. Reuses the existing
 * TimelineRepository.replaceForOfficer (delete-all + insert) so re-import never
 * duplicates timeline rows, and the knowledge layer's `extractTimelineYear` for
 * the parsed numeric year (no duplicated year-parsing logic).
 *
 * The source `year` string is stored verbatim; `yearValue` is the parsed year
 * (or null) — never guessed.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { TimelineRepository, type TimelineRowInput } from "@/lib/database/repositories/timeline_repository";
import { extractTimelineYear } from "@/lib/knowledge/timeline_index";
import { normalizeTimelinePositionUnit } from "@/lib/import/timeline_normalization";
import { DatabaseError } from "@/lib/import/types";

/**
 * Maps normalized timeline entries to sequenced repository rows.
 *
 * Phase 23B: applies normalizeTimelinePositionUnit so the raw OCR output —
 * which sometimes packs the unit into the `position` string, or duplicates it
 * across both fields — is separated into distinct position/unit before it
 * reaches the database. The OCR output itself is untouched (this is the import
 * normalization layer). Deterministic + idempotent.
 */
export function toTimelineRows(
  timeline: Array<{ year?: string | null; position?: string | null; unit?: string | null }>
): TimelineRowInput[] {
  return timeline.map((entry, index) => {
    const normalized = normalizeTimelinePositionUnit({ position: entry.position, unit: entry.unit });
    return {
      sequence: index,
      year: entry.year ?? "",
      yearValue: extractTimelineYear(entry.year ?? ""),
      position: normalized.position,
      unit: normalized.unit,
    };
  });
}

/**
 * Replaces the officer's timeline within the transaction. Returns the number
 * of rows written. Wraps repository failures in DatabaseError.
 */
export async function replaceTimeline(
  tx: DatabaseClient,
  officerRowId: number,
  timeline: Array<{ year?: string | null; position?: string | null; unit?: string | null }>
): Promise<number> {
  const repo = new TimelineRepository(tx);
  try {
    return await repo.replaceForOfficer(officerRowId, toTimelineRows(timeline));
  } catch (error) {
    throw new DatabaseError(`Failed to replace timeline for officer row ${officerRowId}`, error);
  }
}
