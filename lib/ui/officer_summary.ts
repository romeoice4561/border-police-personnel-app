/**
 * Officer presentation helpers (Phase 15A).
 *
 * Pure derivations for the officer detail page — full name, an "AI Quality
 * Summary" sentence built from the persisted quality/knowledge signals, and a
 * year-sorted timeline. Kept out of the React components (no business logic in
 * JSX) and reused rather than duplicated. Mirrors the Phase 11B/14 quality
 * banding; it does not re-run the Quality Layer, only phrases the stored
 * scores/fields.
 *
 * No I/O, no React, no globals.
 */

import type { OfficerWithRelations, Timeline } from "@/lib/database/query_types";
import { bandForScore, LOW_CONFIDENCE_THRESHOLD } from "@/lib/ui/quality";
import { yearBEToGregorian } from "@/lib/officer_profile/thai_date";

/** Display full name, falling back to the officer id when names are blank. */
export function officerFullName(officer: { firstName: string; lastName: string; officerId: string }): string {
  const name = [officer.firstName, officer.lastName].filter((p) => p && p.trim().length > 0).join(" ");
  return name.length > 0 ? name : officer.officerId;
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

/**
 * Builds a readable "AI Quality Summary" from the persisted signals: the
 * quality band + score, knowledge score, and any notable gaps (missing
 * position/unit/phone, empty timeline, low extraction confidence). It states
 * only what the stored data shows — it never invents facts about the officer.
 */
export function buildQualitySummary(officer: OfficerWithRelations): string {
  const { band } = bandForScore(officer.qualityScore);
  const parts: string[] = [];

  if (officer.qualityScore === null || officer.qualityScore === undefined) {
    parts.push("This record has no quality score.");
  } else {
    parts.push(`Overall data quality is ${band.toLowerCase()} (${officer.qualityScore}/100).`);
  }

  if (typeof officer.knowledgeScore === "number") {
    parts.push(`Extraction/knowledge confidence is ${officer.knowledgeScore}/100.`);
  }

  const gaps: string[] = [];
  if (isBlank(officer.rank)) gaps.push("rank");
  if (isBlank(officer.currentPosition)) gaps.push("current position");
  if (isBlank(officer.currentUnit)) gaps.push("current unit");
  if (isBlank(officer.phone)) gaps.push("phone");
  if (officer.timeline.length === 0) gaps.push("career timeline");

  if (gaps.length > 0) {
    parts.push(`Missing ${gaps.join(", ")}.`);
  }

  if (typeof officer.confidence === "number" && officer.confidence <= LOW_CONFIDENCE_THRESHOLD) {
    parts.push("Low extraction confidence — recommend human review.");
  }

  if (gaps.length === 0 && (officer.qualityScore ?? 0) >= 75) {
    parts.push("The record is complete and ready for use.");
  }

  return parts.join(" ");
}

/**
 * A single comparable timestamp for sorting, preferring the precise
 * `effectiveDate` (Phase 26B Part 3 structured model, day/month-aware) and
 * falling back to Jan 1 of `yearValue` for a row not yet migrated. `yearValue`
 * is a Buddhist-Era number (every legacy import/editor writes B.E., e.g.
 * 2560, never a Gregorian year — see Timeline.year's schema comment), so it
 * is converted to Gregorian here, exactly as `effectiveDate` already is, so
 * rows from either era compare on the same timeline without one
 * systematically winning ties. Null when neither is available.
 */
function timelineSortKey(entry: Timeline): number | null {
  if (entry.effectiveDate) return new Date(entry.effectiveDate).getTime();
  if (entry.yearValue !== null) return Date.UTC(yearBEToGregorian(entry.yearValue), 0, 1);
  return null;
}

/**
 * Timeline sorted by year, newest → oldest. Phase 26B Part 3: a row migrated
 * to the structured date model sorts by its precise `effectiveDate`; a row
 * not yet migrated falls back to `yearValue` (the parsed numeric year),
 * exactly as before this phase — both compare on the same underlying
 * timestamp. An entry marked `isPresent` always sorts first (it is, by
 * definition, the most recent/ongoing entry) ahead of any dated entry.
 * Entries with no derivable date sort last, in their original sequence,
 * rather than being guessed at.
 */
export function sortTimelineByYear(timeline: Timeline[]): Timeline[] {
  return [...timeline].sort((a, b) => {
    if (a.isPresent && !b.isPresent) return -1;
    if (!a.isPresent && b.isPresent) return 1;

    const ak = timelineSortKey(a);
    const bk = timelineSortKey(b);
    if (ak === null && bk === null) return a.sequence - b.sequence;
    if (ak === null) return 1;
    if (bk === null) return -1;
    return bk - ak;
  });
}

/**
 * The officer's most current timeline row (Phase 26B Part 5 Part A/H) — the
 * first row after `sortTimelineByYear` (present-first, newest-first) — used
 * to source the header's Verification Badge. Returns null for an officer
 * with no timeline rows yet; never guesses.
 */
export function currentTimelineRow(timeline: Timeline[]): Timeline | null {
  return sortTimelineByYear(timeline)[0] ?? null;
}
