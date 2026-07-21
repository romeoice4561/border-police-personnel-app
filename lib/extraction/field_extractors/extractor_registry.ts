/**
 * Field extractor registry (Phase 48 — spec §11).
 *
 * Maps a detected document type to its FieldExtractor. MEDICAL_DOCUMENT,
 * SALARY_DOCUMENT, ANNUAL_EVALUATION, FIREARMS_QUALIFICATION, and UNKNOWN
 * have no deterministic extractor yet (no field list was specified for
 * them in spec §11 beyond MEDICAL_DOCUMENT/etc. being detectable types) —
 * `getExtractorForType` returns null for these, and the pipeline correctly
 * treats "no extractor available" the same as "required fields missing"
 * for the AI gate (spec §3's REQUIRED_FIELDS_MISSING), never crashing.
 */

import type { FieldExtractor } from "@/lib/extraction/field_extractors/extractor_types";
import type { SupportedDocumentTypeCode } from "@/lib/extraction/document_type_detection";
import { nationalIdExtractor } from "@/lib/extraction/field_extractors/national_id_extractor";
import { driverLicenseExtractor } from "@/lib/extraction/field_extractors/driver_license_extractor";
import { passportExtractor } from "@/lib/extraction/field_extractors/passport_extractor";
import { trainingCertificateExtractor, educationCertificateExtractor, awardExtractor } from "@/lib/extraction/field_extractors/certificate_extractors";
import { gp7Extractor } from "@/lib/extraction/field_extractors/gp7_extractor";

const REGISTRY: Partial<Record<SupportedDocumentTypeCode, FieldExtractor>> = {
  NATIONAL_ID: nationalIdExtractor,
  DRIVER_LICENSE: driverLicenseExtractor,
  PASSPORT: passportExtractor,
  TRAINING_CERTIFICATE: trainingCertificateExtractor,
  EDUCATION_CERTIFICATE: educationCertificateExtractor,
  AWARD: awardExtractor,
  GP7: gp7Extractor,
};

export function getExtractorForType(type: SupportedDocumentTypeCode): FieldExtractor | null {
  return REGISTRY[type] ?? null;
}

/** All document types that currently have a deterministic extractor — for tests and coverage reporting. */
export function getExtractableTypes(): SupportedDocumentTypeCode[] {
  return Object.keys(REGISTRY) as SupportedDocumentTypeCode[];
}
