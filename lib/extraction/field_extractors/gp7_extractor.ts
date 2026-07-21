/**
 * GP7 (ก.พ.7) field extractor (Phase 48 — spec §11).
 *
 * Deliberately minimal per the spec: "extract only fields that can be
 * identified reliably; do not attempt a full personnel-history import in
 * this phase; mark complex tables for future specialized extraction." GP7
 * is a multi-page, multi-table official personnel history form — this
 * extractor only pulls the officer's name and national ID from the form's
 * header block (the one region that reliably appears in a fixed, simple
 * layout), and reports `hasComplexTables: true` via a synthetic field so
 * the review UI can tell the user the rest of the form was not attempted.
 */

import type { ExtractedField } from "@/lib/extraction/extraction_pipeline_types";
import type { FieldExtractor } from "@/lib/extraction/field_extractors/extractor_types";
import { validateThaiNationalId, validateRequired } from "@/lib/extraction/field_validation";

const ID_NUMBER_PATTERN = /\b(\d)\s?(\d{4})\s?(\d{5})\s?(\d{2})\s?(\d)\b/;
const NAME_PATTERN = /ชื่อ(?:-สกุล|ตัวและช[ื]?อสกุล)?\s*[:\s]*([ก-๙\s.]{3,60})/;
const COMPLEX_TABLE_SIGNAL_PATTERN = /ประวัติการรับราชการ|ประวัติการศึกษา|ตำแหน่ง.*วันที่/i;

export const gp7Extractor: FieldExtractor = {
  documentType: "GP7",
  requiredFieldCodes: ["nationalId"],
  extract(normalizedText: string): ExtractedField[] {
    const fields: ExtractedField[] = [];

    const idMatch = normalizedText.match(ID_NUMBER_PATTERN);
    const idNormalized = idMatch ? idMatch.slice(1, 6).join("") : null;
    fields.push({
      code: "nationalId",
      label: "National ID",
      rawValue: idMatch ? idMatch[0] : null,
      normalizedValue: idNormalized,
      normalizationReason: idMatch ? "Grouped digits joined into a single 13-digit ID string." : null,
      confidence: idMatch ? 0.75 : null,
      validation: idNormalized ? validateThaiNationalId(idNormalized) : validateRequired(null, "National ID"),
    });

    const nameMatch = normalizedText.match(NAME_PATTERN);
    fields.push({
      code: "name",
      label: "Name",
      rawValue: nameMatch ? nameMatch[1].trim() : null,
      normalizedValue: nameMatch ? nameMatch[1].trim() : null,
      normalizationReason: null,
      confidence: nameMatch ? 0.6 : null,
      validation: { valid: true, warnings: [] },
    });

    // Synthetic, non-editable informational field — never a real value the
    // user could "approve," just a signal surfaced to the review UI.
    const hasComplexTables = COMPLEX_TABLE_SIGNAL_PATTERN.test(normalizedText);
    fields.push({
      code: "complexTablesDetected",
      label: "Full Career/Education History Tables",
      rawValue: hasComplexTables ? "detected" : null,
      normalizedValue: hasComplexTables ? "detected" : null,
      normalizationReason: hasComplexTables
        ? "GP7's career/education history tables were detected but are not extracted in this phase — reserved for a future specialized table extractor."
        : null,
      confidence: null,
      validation: { valid: true, warnings: hasComplexTables ? ["Full table extraction is not yet supported — only the header fields above were extracted."] : [] },
    });

    return fields;
  },
};
