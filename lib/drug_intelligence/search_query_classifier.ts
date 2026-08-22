/**
 * Global Search query classification (Phase DI-3 — Section 5).
 *
 * A lightweight, deterministic, rule-based classifier — NEVER an AI/LLM call
 * (Section 5's explicit prohibition). The classification INFLUENCES search
 * strategy/ranking (which indexed exact-match lookups to try first) but
 * never excludes other entity types from being searched too — a query
 * classified PHONE still also runs the general-text person/case scan,
 * just after the phone-specific exact lookup (Section 5: "ไม่ควร exclude
 * entity อื่นที่เกี่ยวข้องเกินไป").
 *
 * Pure — no I/O.
 */

export type DrugSearchQueryClassification =
  | "PERSON_NAME"
  | "IDENTIFIER"
  | "PHONE"
  | "IMEI"
  | "VEHICLE_REGISTRATION"
  | "CASE_NUMBER"
  | "GENERAL_TEXT";

/**
 * Case-number pattern: this codebase's Create Case examples consistently
 * use "ตชด.44-2569-001"/"DRUG-2569-00125"-style values — letters/dots
 * followed by a dash-separated numeric tail. Matched loosely (a prefix of
 * letters/Thai-chars/dots, then at least one dash-separated digit group)
 * rather than a rigid format, since case numbering is unit-defined
 * (Section 4's own "ไม่มีอำนาจบังคับ numbering convention" note).
 */
const CASE_NUMBER_PATTERN = /^[A-Za-zก-๙.]+[-.][A-Za-z0-9-]*\d/;

/** Thai national ID: 13 digits, optionally dash-grouped (1-2345-67890-12-3). */
const THAI_ID_PATTERN = /^\d(-?\d){12}$/;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Classifies a raw search query into the single BEST-GUESS intent, used only
 * to order/prioritize which indexed lookups run first — never to exclude
 * other entity types from the broader scan.
 */
export function classifyDrugSearchQuery(rawQuery: string): DrugSearchQueryClassification {
  const trimmed = rawQuery.trim();
  if (!trimmed) return "GENERAL_TEXT";

  if (CASE_NUMBER_PATTERN.test(trimmed)) return "CASE_NUMBER";

  const digits = digitsOnly(trimmed);

  // Thai ID: exactly 13 digits (with or without dash grouping) — checked
  // before generic digit-length rules since it overlaps with "IDENTIFIER".
  if (THAI_ID_PATTERN.test(trimmed) || digits.length === 13) return "IDENTIFIER";

  // IMEI: 14-16 digits (IMEI is 15, IMEISV is 16, some serials trimmed to 14).
  if (digits.length >= 14 && digits.length <= 16 && digits.length === trimmed.replace(/[\s-]/g, "").length) {
    return "IMEI";
  }

  // Thai mobile phone: 9-10 digits (with/without leading 0), or 66-prefixed
  // 11 digits — allowing separators (space/dash) and an optional leading
  // "+", same tolerance normalizePhoneMatchingKey itself applies, so
  // "081-234-5678", "66812345678", and "+66812345678" all classify as PHONE.
  const looksPhoneShaped = /^\+?[\d\s-]+$/.test(trimmed);
  if (looksPhoneShaped) {
    if (digits.length === 10 && digits.startsWith("0")) return "PHONE";
    if (digits.length === 11 && digits.startsWith("66")) return "PHONE";
    if (digits.length === 9) return "PHONE";
  }

  // Vehicle registration: short mixed Thai-letter + digit combos like
  // "กข1234" or "1กข2345" — Thai plates are always LETTERS+DIGITS (or
  // digits+letters+digits for provincial-prefix plates), never letters-only
  // or digits-only, which keeps this from colliding with PERSON_NAME/IDENTIFIER.
  const hasThaiLetter = /[ก-๙]/.test(trimmed);
  const hasDigit = /\d/.test(trimmed);
  const hasLatinLetter = /[A-Za-z]/.test(trimmed);
  if (hasDigit && (hasThaiLetter || hasLatinLetter) && trimmed.replace(/[\s-]/g, "").length <= 10) {
    return "VEHICLE_REGISTRATION";
  }

  // Pure Thai/Latin text with no digits at all — treat as a name.
  if (!hasDigit && (hasThaiLetter || hasLatinLetter)) return "PERSON_NAME";

  return "GENERAL_TEXT";
}
