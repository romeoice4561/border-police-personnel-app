/**
 * YearNormalizer
 *
 * Rule 6: normalizes a timeline entry's year value. If the value contains
 * a Buddhist-era prefix like "พ.ศ.2567" (after Thai numerals have already
 * been converted to Arabic by ThaiNumberConverter), the normalized `year`
 * keeps just the numeral ("2567"), while the original cleaned form is
 * preserved separately as `display_year` for any future display use.
 *
 * Values that are not a recognizable "prefix + 4-digit year" pattern (e.g.
 * "ปัจจุบัน" / "present", or free-text dates) are left as their
 * (Thai-numeral-converted, whitespace-cleaned) input — normalization must
 * not guess a year that isn't actually present (Rule 10).
 *
 * Pure: given a string, returns a { year, display_year } pair. Never
 * mutates input.
 */

const BUDDHIST_ERA_PREFIX_PATTERN = /^(?:พ\.?\s*ศ\.?\s*)(\d{4})$/;
const BARE_FOUR_DIGIT_YEAR_PATTERN = /^\d{4}$/;

export interface NormalizedYear {
  year: string;
  /** Present only when a cleaner display form differs from `year` (e.g. the original had a "พ.ศ." prefix); otherwise omitted. */
  display_year?: string;
}

/** Contract for year normalization. Allows swapping in support for other era conventions (e.g. Gregorian-only sources) later. */
export interface YearNormalizerEngine {
  normalize(input: string): NormalizedYear;
}

/**
 * Extracts a bare numeral year from a (already Thai-numeral-converted,
 * whitespace-cleaned) year string.
 *
 * Examples:
 *   "พ.ศ.2567" -> { year: "2567", display_year: "พ.ศ.2567" }
 *   "2567"     -> { year: "2567" }
 *   "ปัจจุบัน"  -> { year: "ปัจจุบัน" }  (left as-is; not a guessable year)
 */
export class YearNormalizer implements YearNormalizerEngine {
  normalize(input: string): NormalizedYear {
    const buddhistMatch = input.match(BUDDHIST_ERA_PREFIX_PATTERN);
    if (buddhistMatch) {
      return { year: buddhistMatch[1], display_year: input };
    }

    if (BARE_FOUR_DIGIT_YEAR_PATTERN.test(input)) {
      return { year: input };
    }

    return { year: input };
  }
}
