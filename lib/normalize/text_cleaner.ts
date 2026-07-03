/**
 * TextCleaner
 *
 * Rules 2-4 (and the whitespace/wording-preserving half of Rule 9):
 * - Rule 2: trims leading/trailing whitespace, collapses multiple spaces,
 *   collapses duplicate blank lines.
 * - Rule 3: normalizes dash variants (en dash, em dash, minus sign) to a
 *   plain hyphen.
 * - Rule 4: removes duplicated punctuation (e.g. ".." -> ".", ",," -> ",")
 *   and normalizes mixed punctuation spacing.
 *
 * Applied uniformly to every string field the engine touches (names, rank,
 * position, unit, notes, timeline entries) — there are no field-specific
 * special cases here, keeping this reusable and free of hardcoded
 * per-record behavior (per the "no hardcoded special cases" requirement).
 *
 * Pure: given a string, returns a new string. Never mutates input.
 */

import type { FieldNormalizer } from "@/lib/normalize/normalization_types";

const DASH_VARIANTS_PATTERN = /[–—−]/g;
/** Repeated identical punctuation marks (".."，"，，" etc.) collapsed to one. */
const DUPLICATE_PUNCTUATION_PATTERN = /([.,;:!?])\1+/g;
const MULTIPLE_SPACES_PATTERN = / {2,}/g;
const LEADING_TRAILING_SPACE_PER_LINE_PATTERN = /[^\S\n]+$|^[^\S\n]+/gm;
const DUPLICATE_BLANK_LINES_PATTERN = /\n{3,}/g;
const SPACE_BEFORE_PUNCTUATION_PATTERN = /\s+([.,;:!?])/g;

/** Contract for text cleanup. Allows swapping in a more elaborate locale-aware cleaner later. */
export type TextCleanerEngine = FieldNormalizer<string, string>;

/**
 * Cleans whitespace, dash characters, and punctuation in a single string.
 *
 * Examples:
 *   "  John   Doe  "       -> "John Doe"
 *   "2018 – 2020"           -> "2018 - 2020"
 *   "Note..  Extra,,  text" -> "Note. Extra, text"
 */
export class TextCleaner implements TextCleanerEngine {
  normalize(input: string): string {
    let result = input;

    result = result.replace(DASH_VARIANTS_PATTERN, "-");
    result = result.replace(DUPLICATE_PUNCTUATION_PATTERN, "$1");
    result = result.replace(SPACE_BEFORE_PUNCTUATION_PATTERN, "$1");
    result = result.replace(LEADING_TRAILING_SPACE_PER_LINE_PATTERN, "");
    result = result.replace(MULTIPLE_SPACES_PATTERN, " ");
    result = result.replace(DUPLICATE_BLANK_LINES_PATTERN, "\n\n");
    result = result.trim();

    return result;
  }
}
