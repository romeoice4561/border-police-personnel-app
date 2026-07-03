/**
 * ThaiNumberConverter
 *
 * Rule 1: converts every Thai numeral digit (๐-๙) to its Arabic numeral
 * equivalent (0-9), applied recursively to every string field encountered
 * elsewhere in the engine. This module only knows about single strings —
 * recursion across an object graph is the Normalization Engine's job, not
 * this converter's.
 *
 * Pure: given a string, returns a new string. Never mutates input.
 */

import type { FieldNormalizer } from "@/lib/normalize/normalization_types";

const THAI_DIGIT_TO_ARABIC: Record<string, string> = {
  "๐": "0",
  "๑": "1",
  "๒": "2",
  "๓": "3",
  "๔": "4",
  "๕": "5",
  "๖": "6",
  "๗": "7",
  "๘": "8",
  "๙": "9",
};

const THAI_DIGIT_PATTERN = /[๐-๙]/g;

/** Contract for Thai-to-Arabic numeral conversion. Allows swapping in a locale-aware library later if needed. */
export type ThaiNumberConverterEngine = FieldNormalizer<string, string>;

/**
 * Converts Thai numerals to Arabic numerals within a single string,
 * leaving all other characters (including Thai script text, punctuation,
 * and existing Arabic numerals) untouched.
 *
 * Examples:
 *   "พ.ศ.๒๕๖๗"        -> "พ.ศ.2567"
 *   "๒๕๖๔"             -> "2564"
 *   "๐๘๒-๗๕๔-๘๒๔๔"     -> "082-754-8244"
 *   "ปี ๒๕๕๘"          -> "ปี 2558"
 */
export class ThaiNumberConverter implements ThaiNumberConverterEngine {
  normalize(input: string): string {
    return input.replace(THAI_DIGIT_PATTERN, (digit) => THAI_DIGIT_TO_ARABIC[digit] ?? digit);
  }
}
