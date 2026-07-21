/**
 * Extraction logging-safety helpers (Phase 48 — spec §18 Security and
 * Privacy).
 *
 * Personnel documents contain sensitive data (national ID numbers, full raw
 * OCR text of an ID card/passport, etc.). This module is the ONE place that
 * decides what is safe to log — mirrors the existing
 * lib/officer_profile/bank_account.ts's `maskBankAccountNumber` pattern
 * (mask all but the last few characters, pure function, no I/O) rather than
 * inventing a new masking convention.
 *
 * Rules enforced here:
 *   - full OCR text is NEVER logged, only its length and a redacted preview
 *   - a Thai national ID number is NEVER logged in full
 *   - any error object passed through here has field values it's told about
 *     redacted before the error is safe to log/display
 *
 * Pure — no I/O, no React.
 */

/** Masks a Thai national ID (13 digits) to only the last 4, e.g. "1234567890123" -> "xxxxxxxxx0123". Non-digit separators are stripped before masking. */
export function maskNationalId(value: string): string {
  const digitsOnly = value.replace(/[^0-9]/g, "");
  if (digitsOnly.length <= 4) return "x".repeat(Math.max(value.length, 1));
  const visible = digitsOnly.slice(-4);
  return `${"x".repeat(digitsOnly.length - 4)}${visible}`;
}

/**
 * Produces a log-safe preview of raw OCR/extraction text: length only, plus
 * a short non-sensitive prefix (first 20 chars) for debugging context — the
 * full text itself is never returned. Used anywhere the pipeline logs "OCR
 * completed" style diagnostics instead of the actual recognized text.
 */
export function safeTextPreview(text: string, previewChars = 20): { length: number; preview: string } {
  return {
    length: text.length,
    preview: text.length > previewChars ? `${text.slice(0, previewChars)}…` : text,
  };
}

/**
 * Redacts known-sensitive field values out of an extracted-fields record
 * before it is safe to log. Only touches values under keys that look like
 * identity fields (national ID / passport / license number) — every other
 * field is passed through unchanged so non-sensitive diagnostics (document
 * type, confidence, validation status) remain fully readable in logs.
 */
const SENSITIVE_FIELD_KEY_PATTERN = /nationalid|national_id|idnumber|id_number|passportnumber|passport_number/i;

export function redactSensitiveFields<T extends Record<string, unknown>>(fields: T): T {
  const redacted = { ...fields } as Record<string, unknown>;
  for (const key of Object.keys(redacted)) {
    if (SENSITIVE_FIELD_KEY_PATTERN.test(key) && typeof redacted[key] === "string") {
      redacted[key] = maskNationalId(redacted[key] as string);
    }
  }
  return redacted as T;
}
