/**
 * Field extractor contract (Phase 48 — spec §11).
 *
 * Each document type gets one FieldExtractor implementation, taking
 * normalized OCR text and returning the fields spec §11 lists for that
 * type. Extractors never call AI — they are pure regex/keyword field
 * readers over the already-normalized text (see ../normalization.ts).
 *
 * Pure — no I/O, no React.
 */

import type { ExtractedField } from "@/lib/extraction/extraction_pipeline_types";
import type { SupportedDocumentTypeCode } from "@/lib/extraction/document_type_detection";

export interface FieldExtractor {
  documentType: SupportedDocumentTypeCode;
  /** Field codes this extractor considers REQUIRED for its document type — used by ai_gate.ts's REQUIRED_FIELDS_MISSING check. */
  requiredFieldCodes: readonly string[];
  extract(normalizedText: string): ExtractedField[];
}

/** Builds an ExtractedField for a value that needed no normalization (rawValue === normalizedValue). */
export function plainField(
  code: string,
  label: string,
  value: string | null,
  confidence: number | null,
  validation: ExtractedField["validation"]
): ExtractedField {
  return {
    code,
    label,
    rawValue: value,
    normalizedValue: value,
    normalizationReason: null,
    confidence,
    validation,
  };
}
