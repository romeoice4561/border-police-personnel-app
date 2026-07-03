/**
 * CareerEngine
 *
 * Derives career intelligence from a normalized PersonnelExtraction's
 * timeline: total career years, distinct units served, and timeline entry
 * count. Pure derivation over already-validated data — no AI calls, no
 * database, no UI.
 */

import type { PersonnelExtraction, TimelineEntry } from "@/lib/types/vision";

export interface CareerIntelligence {
  careerYears: number;
  unitCount: number;
  timelineEntryCount: number;
  units: string[];
  earliestYear?: number;
  latestYear?: number;
}

/** Contract for career intelligence derivation. Allows swapping in a richer analysis later. */
export interface CareerEngine {
  analyze(extraction: PersonnelExtraction): CareerIntelligence;
}

function parseYear(entry: TimelineEntry): number | undefined {
  const year = Number.parseInt(entry.year, 10);
  return Number.isFinite(year) ? year : undefined;
}

/**
 * Default career engine.
 *
 * Career years is estimated as (latest year - earliest year) across
 * timeline entries with parsable years; falls back to 0 if fewer than two
 * parsable years exist. Future extension point: incorporate an explicit
 * "current" flag or today's date for officers still actively serving.
 */
export class DefaultCareerEngine implements CareerEngine {
  analyze(extraction: PersonnelExtraction): CareerIntelligence {
    const years = extraction.timeline.map(parseYear).filter((y): y is number => y !== undefined);

    const units = Array.from(
      new Set(extraction.timeline.map((entry) => (entry.unit ?? "").trim()).filter((unit) => unit.length > 0))
    );

    const earliestYear = years.length > 0 ? Math.min(...years) : undefined;
    const latestYear = years.length > 0 ? Math.max(...years) : undefined;
    const careerYears = earliestYear !== undefined && latestYear !== undefined ? latestYear - earliestYear : 0;

    return {
      careerYears,
      unitCount: units.length,
      timelineEntryCount: extraction.timeline.length,
      units,
      earliestYear,
      latestYear,
    };
  }
}
