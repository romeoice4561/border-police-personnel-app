/**
 * PhoneImporter (Phase 17).
 *
 * Replaces an officer's Phone rows from the export — delete existing phones,
 * insert the current set — inside the caller's transaction, reusing
 * PhoneRepository.replaceForOfficer so re-import never duplicates phones.
 *
 * The `normalized_extraction` carries a single primary `phone`. The engine
 * also scavenges any additional phone-shaped numbers from the `notes` field
 * (which the OCR pipeline sometimes places a secondary contact number in),
 * WITHOUT inventing anything: only strings that match a phone pattern are
 * taken, and the set is de-duplicated. If no phone is present, the officer's
 * phones are cleared (idempotent — reflects the current record exactly).
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { PhoneRepository } from "@/lib/database/repositories/phone_repository";
import { DatabaseError } from "@/lib/import/types";

/** Matches Thai-style phone numbers (0X-XXXXXXX / 0XX-XXX-XXXX and separated variants). */
const PHONE_PATTERN = /0\d(?:[\s-]?\d){7,9}/g;

/**
 * Collects the distinct phone numbers for an officer: the primary `phone`
 * field plus any phone-shaped tokens found in `notes`. Only real matches are
 * kept — never a fabricated number.
 */
export function collectPhoneNumbers(primaryPhone: string | null | undefined, notes: string | null | undefined): string[] {
  const numbers: string[] = [];
  const add = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    if (trimmed.length > 0) numbers.push(trimmed);
  };

  add(primaryPhone);

  if (typeof notes === "string" && notes.length > 0) {
    const matches = notes.match(PHONE_PATTERN);
    if (matches) for (const m of matches) add(m.trim());
  }

  // De-duplicate while preserving first-seen order.
  const seen = new Set<string>();
  return numbers.filter((n) => (seen.has(n) ? false : (seen.add(n), true)));
}

/**
 * Replaces the officer's phones within the transaction. Returns the number of
 * rows written (0 when the record has no phone). Wraps repository failures in
 * DatabaseError.
 */
export async function replacePhones(
  tx: DatabaseClient,
  officerRowId: number,
  primaryPhone: string | null | undefined,
  notes: string | null | undefined
): Promise<number> {
  const repo = new PhoneRepository(tx);
  const numbers = collectPhoneNumbers(primaryPhone, notes);
  try {
    return await repo.replaceForOfficer(officerRowId, numbers);
  } catch (error) {
    throw new DatabaseError(`Failed to replace phones for officer row ${officerRowId}`, error);
  }
}
