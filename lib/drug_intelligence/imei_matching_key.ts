/**
 * IMEI/serial matching-key normalization (Phase DI-3 — Section 6).
 *
 * DI-1's DrugEntityRepository.findOrCreateDevice matches imei1/imei2/
 * serialNumber by RAW STRING EQUALITY — no normalization step exists
 * anywhere in the Drug Intelligence module today. This introduces one, so
 * DI-3's search can match "35391812345678", "353918 123456 78", and
 * "353918-123456-78" (all the same IMEI typed with different separators) as
 * the same value — a digits-only key, same "never guess/never fabricate"
 * philosophy as normalizePhoneMatchingKey. Deliberately NOT wired back into
 * DrugEntityRepository's existing find-or-create matching (that would be a
 * DI-1/DI-2 behavior change outside DI-3's scope) — this is search-only.
 *
 * Pure — no I/O.
 */

/** Strips every non-digit character. IMEI/serial numbers are matched digits-only; letters in a serial number (rare but possible) are preserved uppercase for exact serial-number search instead — see normalizeSerialMatchingKey below. */
export function normalizeImeiMatchingKey(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Serial numbers may be alphanumeric (unlike IMEI) — normalize to uppercase with whitespace/dashes stripped, never digits-only. */
export function normalizeSerialMatchingKey(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}
