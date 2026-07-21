/**
 * Driver License field extractor (Phase 48 — spec §11).
 * Fields: license number, name, issue date, expiry date, license class when detectable.
 */

import type { ExtractedField } from "@/lib/extraction/extraction_pipeline_types";
import type { FieldExtractor } from "@/lib/extraction/field_extractors/extractor_types";
import { extractDate } from "@/lib/extraction/date_extraction";
import { validateDriverLicenseNumberPattern, validateIsoDate, validateRequired } from "@/lib/extraction/field_validation";

const LICENSE_NUMBER_PATTERN = /(?:เลขที่ใบอนุญาต|license no\.?)\s*[:\s]*([0-9\- ]{5,15})/i;
const NAME_PATTERN = /ชื่อ(?:-สกุล)?\s*[:\s]*([ก-๙\s.]{3,60})/;
const ISSUE_LABEL_PATTERN = /วันออกบัตร|วันที่ออก|issue date/i;
const EXPIRY_LABEL_PATTERN = /วันหมดอายุ|expiry date|expiration date/i;
const CLASS_PATTERN = /ชนิด(?:ที่)?\s*[:\s]*([1-5]|[ก-ฮ])/;

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

export const driverLicenseExtractor: FieldExtractor = {
  documentType: "DRIVER_LICENSE",
  requiredFieldCodes: ["licenseNumber"],
  extract(normalizedText: string): ExtractedField[] {
    const fields: ExtractedField[] = [];

    const licenseMatch = normalizedText.match(LICENSE_NUMBER_PATTERN);
    const licenseRaw = licenseMatch ? licenseMatch[1].trim() : null;
    fields.push({
      code: "licenseNumber",
      label: "License Number",
      rawValue: licenseRaw,
      normalizedValue: licenseRaw,
      normalizationReason: null,
      confidence: licenseMatch ? 0.75 : null,
      validation: licenseRaw ? validateDriverLicenseNumberPattern(licenseRaw) : validateRequired(null, "License Number"),
    });

    const nameMatch = normalizedText.match(NAME_PATTERN);
    fields.push({
      code: "name",
      label: "Name",
      rawValue: nameMatch ? nameMatch[1].trim() : null,
      normalizedValue: nameMatch ? nameMatch[1].trim() : null,
      normalizationReason: null,
      confidence: nameMatch ? 0.7 : null,
      validation: { valid: true, warnings: [] },
    });

    fields.push(dateField("issueDate", "Issue Date", extractDate(normalizedText.match(ISSUE_LABEL_PATTERN) ? normalizedText.slice(normalizedText.search(ISSUE_LABEL_PATTERN)) : "")));
    fields.push(dateField("expiryDate", "Expiry Date", extractDate(normalizedText.match(EXPIRY_LABEL_PATTERN) ? normalizedText.slice(normalizedText.search(EXPIRY_LABEL_PATTERN)) : "")));

    const classMatch = normalizedText.match(CLASS_PATTERN);
    fields.push({
      code: "licenseClass",
      label: "License Class",
      rawValue: classMatch ? classMatch[1] : null,
      normalizedValue: classMatch ? classMatch[1] : null,
      normalizationReason: null,
      confidence: classMatch ? 0.6 : null,
      validation: { valid: true, warnings: [] }, // detectable-when-present, not required
    });

    return fields;
  },
};
