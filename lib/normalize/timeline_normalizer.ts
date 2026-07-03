/**
 * TimelineNormalizer
 *
 * Composes the year normalizer and text cleaning to normalize each
 * timeline entry, then applies:
 *   Rule 7: sort newest -> oldest.
 *   Rule 8: remove duplicate rows (identical year + position + unit).
 *   Rule 9: unit cleanup (whitespace/trim only — never invents a missing
 *           unit; official wording is preserved verbatim otherwise).
 *
 * Pure: given a timeline array, returns a new array. Never mutates input
 * entries or the input array.
 */

import type { TimelineEntry } from "@/lib/types/vision";
import type { NormalizedTimelineEntry } from "@/lib/normalize/normalization_types";
import type { YearNormalizerEngine } from "@/lib/normalize/year_normalizer";
import { YearNormalizer } from "@/lib/normalize/year_normalizer";
import type { TextCleanerEngine } from "@/lib/normalize/text_cleaner";
import { TextCleaner } from "@/lib/normalize/text_cleaner";
import type { ThaiNumberConverterEngine } from "@/lib/normalize/thai_number_converter";
import { ThaiNumberConverter } from "@/lib/normalize/thai_number_converter";

/** Contract for timeline normalization. Allows swapping in a different sort/dedup strategy later. */
export interface TimelineNormalizerEngine {
  normalize(timeline: TimelineEntry[]): NormalizedTimelineEntry[];
}

export interface TimelineNormalizerDependencies {
  thaiNumberConverter?: ThaiNumberConverterEngine;
  textCleaner?: TextCleanerEngine;
  yearNormalizer?: YearNormalizerEngine;
}

/**
 * Extracts a sortable numeric value from a normalized year string, for
 * newest-to-oldest ordering. Non-numeric years (e.g. "ปัจจุบัน" / "present")
 * sort first (treated as the most recent entry) since that is their common
 * real-world meaning on these documents; entries that are neither numeric
 * nor a recognized "present" marker sort last, after all dated entries,
 * rather than being guessed at.
 */
function sortableYearValue(year: string): number {
  const numeric = Number.parseInt(year, 10);
  if (Number.isFinite(numeric) && /^\d+$/.test(year)) {
    return numeric;
  }

  const presentMarkers = ["ปัจจุบัน", "present", "current"];
  if (presentMarkers.some((marker) => year.toLowerCase().includes(marker.toLowerCase()))) {
    return Number.POSITIVE_INFINITY;
  }

  return Number.NEGATIVE_INFINITY;
}

function dedupKey(entry: NormalizedTimelineEntry): string {
  return JSON.stringify([entry.year, entry.position, entry.unit ?? null]);
}

/**
 * Default timeline normalizer: cleans each field, extracts year/display
 * year, sorts newest-to-oldest, and removes exact-duplicate rows.
 */
export class TimelineNormalizer implements TimelineNormalizerEngine {
  private readonly thaiNumberConverter: ThaiNumberConverterEngine;
  private readonly textCleaner: TextCleanerEngine;
  private readonly yearNormalizer: YearNormalizerEngine;

  constructor(dependencies: TimelineNormalizerDependencies = {}) {
    this.thaiNumberConverter = dependencies.thaiNumberConverter ?? new ThaiNumberConverter();
    this.textCleaner = dependencies.textCleaner ?? new TextCleaner();
    this.yearNormalizer = dependencies.yearNormalizer ?? new YearNormalizer();
  }

  normalize(timeline: TimelineEntry[]): NormalizedTimelineEntry[] {
    const cleaned = timeline.map((entry) => this.normalizeEntry(entry));
    const deduped = this.removeDuplicates(cleaned);
    return this.sortNewestToOldest(deduped);
  }

  private normalizeEntry(entry: TimelineEntry): NormalizedTimelineEntry {
    const cleanYearInput = this.cleanString(entry.year);
    const { year, display_year } = this.yearNormalizer.normalize(cleanYearInput);

    // Rule 9: unit cleanup is whitespace/trim only — never invents a
    // missing unit (Rule 10). null/undefined/empty all pass through as-is
    // (after cleaning, an all-whitespace unit collapses to "").
    const unit = entry.unit === null || entry.unit === undefined ? entry.unit : this.cleanString(entry.unit);

    return {
      year,
      position: this.cleanString(entry.position),
      unit,
      ...(display_year !== undefined ? { display_year } : {}),
    };
  }

  private cleanString(value: string): string {
    return this.textCleaner.normalize(this.thaiNumberConverter.normalize(value));
  }

  private removeDuplicates(entries: NormalizedTimelineEntry[]): NormalizedTimelineEntry[] {
    const seen = new Set<string>();
    const result: NormalizedTimelineEntry[] = [];

    for (const entry of entries) {
      const key = dedupKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }

    return result;
  }

  private sortNewestToOldest(entries: NormalizedTimelineEntry[]): NormalizedTimelineEntry[] {
    return [...entries].sort((a, b) => sortableYearValue(b.year) - sortableYearValue(a.year));
  }
}
