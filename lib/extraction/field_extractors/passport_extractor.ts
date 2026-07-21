/**
 * Passport field extractor (Phase 48 — spec §11).
 * Fields: passport number, name, nationality, date of birth, issue date, expiry date.
 */

import type { ExtractedField } from "@/lib/extraction/extraction_pipeline_types";
import type { FieldExtractor } from "@/lib/extraction/field_extractors/extractor_types";
import { extractDate } from "@/lib/extraction/date_extraction";
import { validatePassportNumberPattern, validateIsoDate, validateRequired } from "@/lib/extraction/field_validation";

const PASSPORT_NUMBER_PATTERN = /(?:passport no\.?|เลขที่หนังสือเดินทาง)\s*[:\s]*([A-Z]{1,2}\d{6,8})/i;
const NAME_PATTERN = /(?:Name|Surname[,\s]*Given\s*Name)\s*[:\s]*([A-Za-z\s]{3,60})/i;
const NATIONALITY_PATTERN = /(?:Nationality|สัญชาติ)\s*[:\s]*([A-Za-zก-๙]{3,20})/i;
const BIRTH_LABEL_PATTERN = /Date of Birth|วันเกิด/i;
const ISSUE_LABEL_PATTERN = /Date of Issue|วันออก/i;
const EXPIRY_LABEL_PATTERN = /Date of Expiry|วันหมดอายุ/i;

function dateField(code: string, label: string, extracted: ReturnType<typeof extractDate>): ExtractedField {
  if (!extracted) {
    return { code, label, rawValue: null, normalizedValue: null, normalizationReason: null, confidence: null, validation: validateRequired(null, label) };
  }
  return {
    code,
    label,
    rawValue: extracted.rawValue,
    normalizedValue: extracted.normalizedValue,
    normalizationReason: extracted.reason,
    confidence: extracted.normalizedValue ? 0.75 : 0.3,
    validation: extracted.normalizedValue ? validateIsoDate(extracted.normalizedValue) : { valid: false, warnings: [extracted.reason] },
  };
}

function dateNear(text: string, labelPattern: RegExp): ReturnType<typeof extractDate> {
  const idx = text.search(labelPattern);
  if (idx === -1) return null;
  return extractDate(text.slice(idx, idx + 60));
}

export const passportExtractor: FieldExtractor = {
  documentType: "PASSPORT",
  requiredFieldCodes: ["passportNumber"],
  extract(normalizedText: string): ExtractedField[] {
    const fields: ExtractedField[] = [];

    const numberMatch = normalizedText.match(PASSPORT_NUMBER_PATTERN);
    const numberRaw = numberMatch ? numberMatch[1] : null;
    fields.push({
      code: "passportNumber",
      label: "Passport Number",
      rawValue: numberRaw,
      normalizedValue: numberRaw ? numberRaw.toUpperCase() : null,
      normalizationReason: numberRaw ? "Uppercased for consistency." : null,
      confidence: numberMatch ? 0.85 : null,
      validation: numberRaw ? validatePassportNumberPattern(numberRaw) : validateRequired(null, "Passport Number"),
    });

    const nameMatch = normalizedText.match(NAME_PATTERN);
    fields.push({
      code: "name",
      label: "Name",
      rawValue: nameMatch ? nameMatch[1].trim() : null,
      normalizedValue: nameMatch ? nameMatch[1].trim() : null,
      normalizationReason: null,
      confidence: nameMatch ? 0.65 : null,
      validation: { valid: true, warnings: [] },
    });

    const nationalityMatch = normalizedText.match(NATIONALITY_PATTERN);
    fields.push({
      code: "nationality",
      label: "Nationality",
      rawValue: nationalityMatch ? nationalityMatch[1].trim() : null,
      normalizedValue: nationalityMatch ? nationalityMatch[1].trim() : null,
      normalizationReason: null,
      confidence: nationalityMatch ? 0.6 : null,
      validation: { valid: true, warnings: [] },
    });

    fields.push(dateField("dateOfBirth", "Date of Birth", dateNear(normalizedText, BIRTH_LABEL_PATTERN)));
    fields.push(dateField("issueDate", "Issue Date", dateNear(normalizedText, ISSUE_LABEL_PATTERN)));
    fields.push(dateField("expiryDate", "Expiry Date", dateNear(normalizedText, EXPIRY_LABEL_PATTERN)));

    return fields;
  },
};
