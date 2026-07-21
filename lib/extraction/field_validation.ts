/**
 * Deterministic field validation (Phase 48 — spec §13).
 *
 * Every check here is a pure, well-defined rule — no AI, no heuristic
 * guessing. Invalid values are NEVER discarded: every validator returns a
 * structured result (valid + warnings[]) so the review UI can still show
 * the raw/normalized value alongside its warning status, per spec's
 * explicit "do not discard invalid values."
 *
 * Pure — no I/O, no React.
 */

import type { FieldValidationResult } from "@/lib/extraction/extraction_pipeline_types";

function ok(): FieldValidationResult {
  return { valid: true, warnings: [] };
}
function fail(...warnings: string[]): FieldValidationResult {
  return { valid: false, warnings };
}

/**
 * Thai national ID checksum (mod-11 over the first 12 digits, compared
 * against the 13th check digit) — the standard algorithm used on every
 * Thai ID card. Accepts digits-only or a formatted "1-2345-67890-12-3"
 * string.
 */
export function validateThaiNationalId(value: string): FieldValidationResult {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length !== 13) return fail(`Expected 13 digits, found ${digits.length}.`);

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(digits[i]) * (13 - i);
  }
  const expectedCheckDigit = (11 - (sum % 11)) % 10;
  const actualCheckDigit = Number(digits[12]);

  if (expectedCheckDigit !== actualCheckDigit) {
    return fail(`Checksum digit mismatch (expected ${expectedCheckDigit}, found ${actualCheckDigit}).`);
  }
  return ok();
}

/** True when `isoDate` is a real, parseable calendar date in yyyy-mm-dd form. */
export function validateIsoDate(isoDate: string): FieldValidationResult {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fail(`"${isoDate}" is not in yyyy-mm-dd format.`);

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));

  const roundTrips = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!roundTrips) return fail(`"${isoDate}" is not a real calendar date.`);
  return ok();
}

/** Expiry must be strictly after issue, when both are present and individually valid. */
export function validateExpiryAfterIssue(issueIso: string | null, expiryIso: string | null): FieldValidationResult {
  if (!issueIso || !expiryIso) return ok(); // nothing to compare — not this validator's job to require presence
  const issueCheck = validateIsoDate(issueIso);
  const expiryCheck = validateIsoDate(expiryIso);
  if (!issueCheck.valid || !expiryCheck.valid) return ok(); // individual date validity is reported by validateIsoDate itself; avoid a redundant/confusing second warning

  if (new Date(expiryIso).getTime() <= new Date(issueIso).getTime()) {
    return fail(`Expiry date (${expiryIso}) must be after issue date (${issueIso}).`);
  }
  return ok();
}

/**
 * Plausibility check for a date that should be neither absurdly far in the
 * past nor the future relative to `asOf` — catches OCR digit-swap errors
 * (e.g. reading "2568" as "2658") without hardcoding a business rule about
 * what's "valid" for a specific field; callers pass the plausible window
 * for their context (e.g. an issue date should not be > 1 year in the
 * future; a birth date should not be in the future at all).
 */
export function validateDatePlausibility(
  isoDate: string,
  window: { maxPastYears?: number; maxFutureYears?: number },
  asOf: Date = new Date()
): FieldValidationResult {
  const check = validateIsoDate(isoDate);
  if (!check.valid) return check;

  const date = new Date(isoDate);
  const yearsDiff = (date.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  if (window.maxPastYears !== undefined && yearsDiff < -window.maxPastYears) {
    return fail(`Date is more than ${window.maxPastYears} years in the past — check for an OCR digit error.`);
  }
  if (window.maxFutureYears !== undefined && yearsDiff > window.maxFutureYears) {
    return fail(`Date is more than ${window.maxFutureYears} years in the future — check for an OCR digit error.`);
  }
  return ok();
}

/** Non-empty required field. */
export function validateRequired(value: string | null, fieldLabel: string): FieldValidationResult {
  if (value === null || value.trim().length === 0) return fail(`${fieldLabel} is required but was not found.`);
  return ok();
}

/** Loose passport-number pattern: 1-2 letters followed by 6-8 digits (covers Thai and most common passport formats without over-fitting to one country). */
export function validatePassportNumberPattern(value: string): FieldValidationResult {
  const trimmed = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{1,2}\d{6,8}$/.test(trimmed)) {
    return fail(`"${value}" does not match the expected passport-number pattern (1-2 letters + 6-8 digits).`);
  }
  return ok();
}

/** Thai driver license numbers are commonly 8 digits (format varies by issuance era) — validated as digits-only, 5-10 digits, deliberately loose since no single canonical format is guaranteed. */
export function validateDriverLicenseNumberPattern(value: string): FieldValidationResult {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 5 || digits.length > 10) {
    return fail(`"${value}" does not look like a driver license number (expected 5-10 digits, found ${digits.length}).`);
  }
  return ok();
}

/** Merges multiple validation results for the same field into one — invalid if ANY constituent check failed, warnings concatenated in order. */
export function mergeValidationResults(...results: FieldValidationResult[]): FieldValidationResult {
  const warnings = results.flatMap((r) => r.warnings);
  return { valid: warnings.length === 0, warnings };
}
