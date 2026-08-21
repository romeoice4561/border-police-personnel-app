/**
 * Phone matching-key normalization (Phase DI-1 — Section 6).
 *
 * Distinct from the existing lib/normalize/phone_normalizer.ts (PhoneNormalizer),
 * which reformats a Thai mobile number into a DISPLAY string
 * ("082-754-8244") for the Personnel/OCR import pipeline. This module
 * produces a MATCHING KEY instead — digits-only, country-code-normalized
 * ("66812345678") — the value DrugPhoneNumber.normalizedNumber is keyed on,
 * so "081-234-5678", "0812345678", and "+66812345678" all resolve to the
 * SAME DrugPhoneNumber row (Section 6's explicit requirement). The two
 * normalizers serve different purposes and are not interchangeable; this
 * module never reuses PhoneNormalizer's display-formatting logic.
 *
 * Pure — no I/O.
 */

/**
 * Normalizes a Thai phone number input into a matching key: digits only,
 * leading "0" replaced with the "66" country code, a leading "+" or "66"
 * left as-is (just stripped of the "+"). Any input that isn't clearly a
 * Thai-style number (wrong digit count after normalization) is returned as
 * digits-only WITHOUT a country-code guess — never fabricated, matching this
 * codebase's "never guess" convention (see PhoneNormalizer's doc comment).
 */
export function normalizePhoneMatchingKey(raw: string): string {
  const digitsOnly = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");

  if (digitsOnly.startsWith("66") && digitsOnly.length === 11) {
    return digitsOnly;
  }
  if (digitsOnly.startsWith("0") && digitsOnly.length === 10) {
    return `66${digitsOnly.slice(1)}`;
  }
  // Doesn't match a recognizable Thai mobile shape — return the digits as
  // typed rather than guessing a country code (never hallucinate/never guess).
  return digitsOnly;
}
