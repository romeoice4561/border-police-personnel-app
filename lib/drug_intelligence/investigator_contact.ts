/**
 * Case-level investigating-officer contact helpers.
 *
 * These values are administrative case contact text. They must never be
 * converted into a DrugPhoneNumber matching key or linked as DrugCasePhone.
 */

import { PhoneNormalizer } from "@/lib/normalize/phone_normalizer";

const displayPhone = new PhoneNormalizer();

export function normalizeInvestigatorContactName(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Persist a human-entered contact number. Standard 10-digit Thai mobiles
 * are stored as XXX-XXX-XXXX; anything else is stored trimmed, unchanged.
 */
export function normalizeInvestigatorContactPhone(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  return displayPhone.normalize(trimmed);
}

export function omitInvestigatorPhoneFromListRow<T extends { investigatorPhone?: string | null }>(
  row: T
): Omit<T, "investigatorPhone"> {
  const { investigatorPhone, ...rest } = row;
  void investigatorPhone;
  return rest;
}

