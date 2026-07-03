/**
 * Shared types for the Normalization Engine (Phase 7.5).
 *
 * This layer sits strictly between Validation and the Career Engine:
 * Validation -> Normalization Engine -> Career Engine. It never talks to
 * Google Drive, Supabase, a database, or any UI — it is a pure
 * data-shaping stage over an already-validated PersonnelExtraction.
 */

import type { PersonnelExtraction, TimelineEntry } from "@/lib/types/vision";

/**
 * A timeline entry after normalization. Adds `display_year` (Rule 6):
 * the cleaned display form of the year as it appeared on the source
 * document (e.g. with a "พ.ศ." prefix converted to Arabic numerals, but
 * prefix wording preserved), separate from `year` which is normalized to a
 * bare comparable value used for sorting (Rule 7).
 */
export interface NormalizedTimelineEntry extends TimelineEntry {
  /** Optional cleaned display form of the year; present only when derivable from the source value. */
  display_year?: string | null;
}

/** A PersonnelExtraction after normalization: same shape, but every field has passed through the Normalization Engine's rules. */
export interface NormalizedPersonnelExtraction extends Omit<PersonnelExtraction, "timeline"> {
  timeline: NormalizedTimelineEntry[];
}

/**
 * Contract every individual normalization stage (Thai numerals, phone,
 * year, text cleanup, timeline ordering/dedup) must implement. Each stage
 * is a pure function object: given an input, it returns a new output,
 * never mutating its argument (Rule 11).
 */
export interface FieldNormalizer<TInput, TOutput> {
  normalize(input: TInput): TOutput;
}

/** Contract for the top-level engine composing all field-level normalizers. */
export interface NormalizationEngine {
  normalize(extraction: PersonnelExtraction): NormalizedPersonnelExtraction;
}
