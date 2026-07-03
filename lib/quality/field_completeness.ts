/**
 * Field completeness (Phase 11B).
 *
 * Pure functions that inspect an exported personnel extraction and report
 * which of the nine scored fields are present, plus identity and phone
 * quality. Read-only — inspects, never modifies. No globals, no I/O.
 */

import type { PersonnelExtraction } from "@/lib/types/vision";
import type { QualityField } from "@/lib/quality/quality_types";

/** The nine fields scored for completeness. */
export const SCORED_FIELDS: QualityField[] = [
  "rank",
  "first_name",
  "last_name",
  "position",
  "unit",
  "phone",
  "timeline",
  "notes",
  "confidence",
];

/** Identity subset (present-and-non-empty makes identity complete). */
export const IDENTITY_FIELDS: QualityField[] = ["rank", "first_name", "last_name", "position", "unit"];

/** Well-formed Thai mobile phone: XXX-XXX-XXXX. */
const WELL_FORMED_PHONE = /^\d{3}-\d{3}-\d{4}$/;

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** True if a single scored field is present/non-empty on the extraction. */
export function isFieldPresent(extraction: PersonnelExtraction, field: QualityField): boolean {
  switch (field) {
    case "timeline":
      return Array.isArray(extraction.timeline) && extraction.timeline.length > 0;
    case "confidence":
      return typeof extraction.confidence === "number" && !Number.isNaN(extraction.confidence);
    default:
      return nonEmptyString(extraction[field]);
  }
}

/** The scored fields that are missing/empty on this record. */
export function missingFields(extraction: PersonnelExtraction): QualityField[] {
  return SCORED_FIELDS.filter((field) => !isFieldPresent(extraction, field));
}

/** 0-100: share of the nine scored fields that are present. */
export function fieldCompletenessScore(extraction: PersonnelExtraction): number {
  const present = SCORED_FIELDS.filter((field) => isFieldPresent(extraction, field)).length;
  return Math.round((present / SCORED_FIELDS.length) * 100);
}

/** 0-100: share of the five identity fields present. */
export function identityCompletenessScore(extraction: PersonnelExtraction): number {
  const present = IDENTITY_FIELDS.filter((field) => isFieldPresent(extraction, field)).length;
  return Math.round((present / IDENTITY_FIELDS.length) * 100);
}

/**
 * 0-100 phone quality: 0 when missing, 60 when present but not in the
 * canonical XXX-XXX-XXXX form (still a value, just unverified format), 100
 * when well-formed. Never rewrites the phone — only scores it.
 */
export function phoneQualityScore(extraction: PersonnelExtraction): number {
  const phone = typeof extraction.phone === "string" ? extraction.phone.trim() : "";
  if (phone.length === 0) return 0;
  return WELL_FORMED_PHONE.test(phone) ? 100 : 60;
}
