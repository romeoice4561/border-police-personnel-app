/**
 * Timeline quality (Phase 11B).
 *
 * Pure analysis of a record's timeline: missing years, missing units, empty
 * rows, duplicate entries, and ordering. Read-only — reports issues, never
 * reorders or edits the timeline (that is the Normalization/Repair engines'
 * job, which this phase must not touch). Reuses the knowledge layer's
 * `extractTimelineYear` for numeric year detection rather than duplicating it.
 *
 * No globals, no I/O.
 */

import type { TimelineEntry } from "@/lib/types/vision";
import { extractTimelineYear } from "@/lib/knowledge/timeline_index";

export interface TimelineQualityFindings {
  entryCount: number;
  missingYear: number;
  missingUnit: number;
  emptyRows: number;
  duplicateEntries: number;
  /** True when the parseable years are NOT in newest→oldest order. */
  outOfOrder: boolean;
  /** 0-100 composite timeline completeness/quality. */
  score: number;
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

function isEmptyRow(entry: TimelineEntry): boolean {
  return isBlank(entry.year) && isBlank(entry.position) && isBlank(entry.unit ?? "");
}

function dedupKey(entry: TimelineEntry): string {
  return JSON.stringify([entry.year ?? "", entry.position ?? "", entry.unit ?? ""]);
}

/**
 * Analyzes a timeline. An absent/empty timeline scores 0. Otherwise the score
 * starts at 100 and is reduced for each quality issue found (missing years,
 * missing units, empty rows, duplicates, bad ordering), floored at 0.
 */
export function analyzeTimeline(timeline: TimelineEntry[]): TimelineQualityFindings {
  const entries = Array.isArray(timeline) ? timeline : [];
  const entryCount = entries.length;

  if (entryCount === 0) {
    return { entryCount: 0, missingYear: 0, missingUnit: 0, emptyRows: 0, duplicateEntries: 0, outOfOrder: false, score: 0 };
  }

  let missingYear = 0;
  let missingUnit = 0;
  let emptyRows = 0;

  for (const entry of entries) {
    if (isEmptyRow(entry)) emptyRows += 1;
    if (isBlank(entry.year)) missingYear += 1;
    if (isBlank(entry.unit ?? "")) missingUnit += 1;
  }

  // Duplicate rows (identical year|position|unit).
  const seen = new Set<string>();
  let duplicateEntries = 0;
  for (const entry of entries) {
    const key = dedupKey(entry);
    if (seen.has(key)) duplicateEntries += 1;
    else seen.add(key);
  }

  // Ordering: parseable years should be non-increasing (newest → oldest).
  const years = entries.map((e) => extractTimelineYear(e.year)).filter((y): y is number => y !== null);
  let outOfOrder = false;
  for (let i = 1; i < years.length; i += 1) {
    if (years[i] > years[i - 1]) {
      outOfOrder = true;
      break;
    }
  }

  // Composite score: proportion of well-formed rows, penalized for dupes/order.
  const yearScore = 1 - missingYear / entryCount;
  const unitScore = 1 - missingUnit / entryCount;
  const emptyScore = 1 - emptyRows / entryCount;
  const dupScore = 1 - duplicateEntries / entryCount;
  const orderScore = outOfOrder ? 0.85 : 1;

  // Weight year/completeness heavily (year+position are the required fields);
  // unit is legitimately often missing so it is weighted lightly.
  const raw = (yearScore * 0.4 + emptyScore * 0.25 + dupScore * 0.15 + unitScore * 0.1 + 0.1) * orderScore;
  const score = Math.max(0, Math.min(100, Math.round(raw * 100)));

  return { entryCount, missingYear, missingUnit, emptyRows, duplicateEntries, outOfOrder, score };
}
