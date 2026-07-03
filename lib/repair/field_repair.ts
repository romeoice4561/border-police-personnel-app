/**
 * Field-level repairs (Phase 10C).
 *
 * Pure repair operations over individual string/phone/year values. Each
 * returns the repaired value plus a list of RepairActions describing exactly
 * what changed, so nothing is silently altered and nothing is invented.
 *
 * Reuses the existing pure normalization converters (ThaiNumberConverter,
 * TextCleaner, PhoneNormalizer, YearNormalizer) rather than duplicating their
 * logic — the repair layer only decides WHICH cleanups are legitimate before
 * validation, and reports them; the actual character-level transforms are the
 * already-tested normalization utilities.
 *
 * Every function here is a pure function of its input. No globals, no I/O.
 */

import { ThaiNumberConverter } from "@/lib/normalize/thai_number_converter";
import { TextCleaner } from "@/lib/normalize/text_cleaner";
import { PhoneNormalizer } from "@/lib/normalize/phone_normalizer";
import { YearNormalizer } from "@/lib/normalize/year_normalizer";
import type { RepairAction } from "@/lib/repair/repair_types";

const thaiNumbers = new ThaiNumberConverter();
const textCleaner = new TextCleaner();
const phoneNormalizer = new PhoneNormalizer();
const yearNormalizer = new YearNormalizer();

/** Detects any Thai numeral so a conversion can be reported precisely. */
const THAI_NUMERAL_PATTERN = /[๐-๙]/;
/** Dash variants (en/em/minus) whose normalization to a plain hyphen is reportable. */
const DASH_VARIANTS_PATTERN = /[–—−]/;

export interface RepairedString {
  /** The repaired string, or null when a blank/whitespace-only value was converted to null. */
  value: string | null;
  actions: RepairAction[];
}

/**
 * Repairs a required string field: Thai numerals → Arabic, whitespace trim,
 * collapse duplicate spaces, dash normalize. A value that is blank or
 * whitespace-only after cleaning is NOT converted to null here (required
 * fields must stay strings so validation can still flag them — repair never
 * hides a genuinely-missing required field). Reports each distinct kind of
 * change that occurred.
 */
export function repairRequiredString(input: string, field: string): RepairedString {
  return cleanString(input, field, { blankToNull: false });
}

/**
 * Repairs an OPTIONAL string field (phone/notes/timeline unit): same
 * cleanups, and additionally converts a blank/whitespace-only result to null
 * (an "impossible"/empty value → null, which is explicitly allowed).
 */
export function repairOptionalString(input: string | null | undefined, field: string): RepairedString {
  if (input === null || input === undefined) {
    return { value: null, actions: [] };
  }
  return cleanString(input, field, { blankToNull: true });
}

function cleanString(input: string, field: string, options: { blankToNull: boolean }): RepairedString {
  const actions: RepairAction[] = [];
  let value = input;

  if (THAI_NUMERAL_PATTERN.test(value)) {
    const converted = thaiNumbers.normalize(value);
    if (converted !== value) {
      actions.push({ type: "thai_numeral_to_arabic", field, detail: `"${value}" → "${converted}"` });
      value = converted;
    }
  }

  if (DASH_VARIANTS_PATTERN.test(value)) {
    actions.push({ type: "dash_normalize", field, detail: "normalized dash variant(s) to '-'" });
  }

  const hadDoubleSpace = / {2,}/.test(value);
  const hadEdgeSpace = value !== value.trim();
  const cleaned = textCleaner.normalize(value);

  if (cleaned !== value) {
    if (hadEdgeSpace) actions.push({ type: "whitespace_trim", field, detail: "trimmed surrounding whitespace" });
    if (hadDoubleSpace) actions.push({ type: "collapse_spaces", field, detail: "collapsed duplicate spaces" });
    value = cleaned;
  }

  if (options.blankToNull && value.trim().length === 0) {
    actions.push({ type: "blank_to_null", field, detail: 'blank value → null' });
    return { value: null, actions };
  }

  return { value, actions };
}

/**
 * Repairs a phone field: Thai numerals → Arabic, then reformat to
 * XXX-XXX-XXXX when it resolves to a standard 10-digit number (reusing
 * PhoneNormalizer — malformed/non-standard numbers are left as-is, never
 * guessed). Also de-duplicates a phone that contains the same number twice
 * (e.g. "081-540-7336 081-540-7336" → one value). Blank → null.
 */
export function repairPhone(input: string | null | undefined, field = "phone"): RepairedString {
  if (input === null || input === undefined) {
    return { value: null, actions: [] };
  }

  const actions: RepairAction[] = [];
  let value = input;

  if (THAI_NUMERAL_PATTERN.test(value)) {
    const converted = thaiNumbers.normalize(value);
    if (converted !== value) {
      actions.push({ type: "thai_numeral_to_arabic", field, detail: `"${value}" → "${converted}"` });
      value = converted;
    }
  }

  // De-duplicate a repeated phone number: split on whitespace/commas, and if
  // every non-empty token is identical, keep a single one.
  const tokens = value.split(/[\s,]+/).filter((t) => t.length > 0);
  if (tokens.length > 1 && new Set(tokens).size === 1) {
    actions.push({ type: "phone_dedup", field, detail: `duplicate phone "${value}" → "${tokens[0]}"` });
    value = tokens[0];
  }

  const trimmed = textCleaner.normalize(value);
  if (trimmed !== value) {
    actions.push({ type: "whitespace_trim", field, detail: "trimmed/collapsed phone whitespace" });
    value = trimmed;
  }

  const reformatted = phoneNormalizer.normalize(value);
  if (reformatted !== value) {
    actions.push({ type: "phone_reformat", field, detail: `"${value}" → "${reformatted}"` });
    value = reformatted;
  }

  if (value.trim().length === 0) {
    actions.push({ type: "blank_to_null", field, detail: "blank phone → null" });
    return { value: null, actions };
  }

  return { value, actions };
}

/**
 * Repairs a timeline year: Thai numerals → Arabic, whitespace clean, then
 * extract the bare numeral from a "พ.ศ.2567"-style value (reusing
 * YearNormalizer). Never fabricates a year — a non-year value passes through.
 */
export function repairYear(input: string, field: string): RepairedString {
  const actions: RepairAction[] = [];
  let value = input;

  if (THAI_NUMERAL_PATTERN.test(value)) {
    const converted = thaiNumbers.normalize(value);
    if (converted !== value) {
      actions.push({ type: "thai_numeral_to_arabic", field, detail: `"${value}" → "${converted}"` });
      value = converted;
    }
  }

  const cleaned = textCleaner.normalize(value);
  if (cleaned !== value) {
    actions.push({ type: "whitespace_trim", field, detail: "trimmed year whitespace" });
    value = cleaned;
  }

  const { year } = yearNormalizer.normalize(value);
  if (year !== value) {
    actions.push({ type: "year_reformat", field, detail: `"${value}" → "${year}"` });
    value = year;
  }

  return { value, actions };
}
