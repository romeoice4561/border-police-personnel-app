/**
 * Shared Timeline-date lookup helpers (Personnel Intelligence Platform —
 * Phase 40A foundation).
 *
 * Consolidates the two other verbatim-duplicated helpers from
 * lib/server/commander_intelligence_service.ts and
 * lib/server/commander_query_service.ts. Both services now import these
 * instead of maintaining their own copy. Behavior unchanged.
 *
 * Pure — no I/O, no React, no database.
 */

import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { Timeline } from "@/lib/database/database_types";
import { toEffectiveDate } from "@/lib/officer_profile/thai_date";

/** The earliest dated Timeline row for an officer — the best-available signal for "when service-like history begins" (not an official government-service-start field; the schema has none yet). */
export function firstServiceLikeDate(officer: OfficerWithRelations): Date | null {
  const dates = officer.timeline
    .map((row) => toEffectiveDate(row))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}

/** The earliest effective date among Timeline rows matching `predicate` — e.g. "first row at the current rank" or "first row at the current position level". */
export function startedAtForMatchingTimeline(rows: Timeline[], predicate: (row: Timeline) => boolean): Date | null {
  const matches = rows
    .filter(predicate)
    .map((row) => toEffectiveDate(row))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return matches[0] ?? null;
}
