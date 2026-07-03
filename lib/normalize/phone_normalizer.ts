/**
 * PhoneNormalizer
 *
 * Rule 5: normalizes Thai mobile-style phone numbers into a consistent
 * `XXX-XXX-XXXX` format, accepting common source variations:
 *   "0827548244"   -> "082-754-8244"
 *   "082 754 8244" -> "082-754-8244"
 *   "082-7548244"  -> "082-754-8244"
 *
 * Only reformats numbers that resolve to exactly 10 digits (the standard
 * Thai mobile number length) after stripping separators — anything else
 * (missing/malformed/non-standard-length numbers) is returned unchanged
 * rather than guessed at, per Rule 10 (never hallucinate/never guess).
 *
 * Pure: given a string, returns a new string. Never mutates input.
 */

import type { FieldNormalizer } from "@/lib/normalize/normalization_types";

const SEPARATOR_PATTERN = /[\s-]+/g;
const STANDARD_THAI_MOBILE_LENGTH = 10;

/** Contract for phone number normalization. Allows swapping in a broader/international format later. */
export type PhoneNormalizerEngine = FieldNormalizer<string, string>;

/**
 * Reformats a phone number string into `XXX-XXX-XXXX` when it contains
 * exactly 10 digits once whitespace/hyphens are stripped; otherwise
 * returns the input unchanged (e.g. landline numbers, extensions, or
 * malformed OCR output are left as-is rather than forced into a shape that
 * might misrepresent the source).
 */
export class PhoneNormalizer implements PhoneNormalizerEngine {
  normalize(input: string): string {
    const digitsOnly = input.replace(SEPARATOR_PATTERN, "");

    if (!/^\d+$/.test(digitsOnly) || digitsOnly.length !== STANDARD_THAI_MOBILE_LENGTH) {
      return input;
    }

    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
}
