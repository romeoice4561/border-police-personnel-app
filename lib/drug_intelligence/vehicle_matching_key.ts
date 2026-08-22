/**
 * Vehicle registration / VIN matching-key normalization (Phase DI-3 —
 * Section 6). Same rationale as imei_matching_key.ts: DI-1's
 * findOrCreateVehicle matches registrationNumber/vin by raw string equality
 * with no normalization step; DI-3's search introduces one so "กข 1234",
 * "กข-1234", and "กข1234" are all found as the same plate.
 *
 * Pure — no I/O.
 */

/** Strips whitespace and dashes, keeps Thai/Latin letters and digits as typed (never re-cases Thai script; Latin letters upper-cased for VIN-style values). */
export function normalizeVehicleRegistrationMatchingKey(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/** VINs are Latin-alphanumeric by international convention — normalize to uppercase with whitespace/dashes stripped. */
export function normalizeVinMatchingKey(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}
