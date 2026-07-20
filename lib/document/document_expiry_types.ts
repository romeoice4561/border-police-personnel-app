/**
 * Expiry-Enabled Document Types (Phase 47 — Document Expiry Intelligence).
 *
 * A document type is "expiry-enabled" when it's the kind of document that
 * realistically has an issue/expiry date (ID cards, licenses, certificates)
 * as opposed to one-time records (appointment orders, GP7). This is a
 * presentation/filtering hint only — it does NOT block a user from setting
 * expiry dates on any document type; it just determines which types show
 * expiry fields by default and which the Expiry Intelligence dashboard
 * actively tracks/expects.
 *
 * Spec §2 requires "Vehicle Insurance" and "Professional License", neither
 * of which existed in the type registry before this phase — registered here
 * the same extensible way lib/document/document_categories.ts registered
 * its additional types, then folded into the existing Miscellaneous category
 * (lib/document/document_categories.ts) so they render somewhere in the e-PF
 * without inventing a new category. No DB enum, no schema change.
 */

import { registerDocumentType } from "@/lib/document/document_types";

registerDocumentType({ code: "VEHICLE_INSURANCE", labelTh: "ประกันภัยรถยนต์", labelEn: "Vehicle Insurance" });
registerDocumentType({ code: "PROFESSIONAL_LICENSE", labelTh: "ใบอนุญาตประกอบวิชาชีพ", labelEn: "Professional License" });

const EXPIRY_ENABLED_TYPES = new Set<string>([
  "NATIONAL_ID",
  "DRIVER_LICENSE",
  "PASSPORT",
  "VEHICLE_INSURANCE",
  "MEDICAL_DOCUMENT",
  "FIREARMS_QUALIFICATION",
  "PROFESSIONAL_LICENSE",
]);

/** True if `code` is a document type the Expiry Intelligence dashboard actively tracks. */
export function isExpiryEnabledType(code: string): boolean {
  return EXPIRY_ENABLED_TYPES.has(code);
}

/** Registers an additional document type as expiry-enabled. Idempotent. */
export function registerExpiryEnabledType(code: string): void {
  EXPIRY_ENABLED_TYPES.add(code);
}

/** All currently expiry-enabled type codes, for tests/UI enumeration. */
export function getExpiryEnabledTypes(): readonly string[] {
  return [...EXPIRY_ENABLED_TYPES];
}
