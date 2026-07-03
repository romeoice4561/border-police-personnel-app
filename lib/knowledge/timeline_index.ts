/**
 * Timeline index (Phase 11A): Timeline Year -> timeline entries dated to it.
 *
 * Real timeline years are messy strings ("20 ธ.ค. 64", "1 พ.ค. 48",
 * "ปัจจุบัน", "พ.ศ.2567"). `extractTimelineYear` pulls a comparable numeric
 * year when one is present, WITHOUT inventing anything: a value with no
 * recognizable year (e.g. "ปัจจุบัน"/present) returns null and is simply not
 * indexed by year. Thai numerals are converted via the existing converter
 * (reused, not duplicated).
 *
 * Pure; no globals, no I/O.
 */

import type { KnowledgeOfficer, IndexedTimelineEntry } from "@/lib/knowledge/knowledge_types";
import { ThaiNumberConverter } from "@/lib/normalize/thai_number_converter";

const thaiNumbers = new ThaiNumberConverter();

/**
 * Extracts a numeric year from a timeline year string, or null if none is
 * present. Recognizes (after Thai→Arabic conversion):
 *   - a 4-digit year anywhere in the string ("พ.ศ.2567" -> 2567), preferred;
 *   - otherwise a trailing/standalone 2-digit year ("20 ธ.ค. 64" -> 64),
 *     which on these Buddhist-era records is the abbreviated พ.ศ. year.
 * Never guesses a century or converts eras — it reports the number that is
 * actually written.
 */
export function extractTimelineYear(rawYear: string): number | null {
  const converted = thaiNumbers.normalize(rawYear ?? "");

  const fourDigit = converted.match(/\d{4}/);
  if (fourDigit) return Number.parseInt(fourDigit[0], 10);

  // Prefer the last standalone 1-2 digit group (the year sits at the end of
  // "day month year" Thai dates like "20 ธ.ค. 64").
  const shortMatches = converted.match(/\d{1,2}/g);
  if (shortMatches && shortMatches.length > 0) {
    return Number.parseInt(shortMatches[shortMatches.length - 1], 10);
  }

  return null;
}

/** Builds Timeline Year -> entries (each tagged with its officer id). */
export function buildTimelineIndex(officers: KnowledgeOfficer[]): Map<number, IndexedTimelineEntry[]> {
  const index = new Map<number, IndexedTimelineEntry[]>();

  for (const officer of officers) {
    for (const entry of officer.timeline) {
      const year = extractTimelineYear(entry.year);
      if (year === null) continue;

      const tagged: IndexedTimelineEntry = { officerId: officer.identity.id, entry };
      const bucket = index.get(year);
      if (bucket) {
        bucket.push(tagged);
      } else {
        index.set(year, [tagged]);
      }
    }
  }

  return index;
}
