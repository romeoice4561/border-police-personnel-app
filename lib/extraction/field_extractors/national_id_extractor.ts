/**
 * National ID Card field extractor (Phase 48 — spec §11).
 *
 * Fields: ID number, Thai name, English name (when present), date of
 * birth, issue date, expiry date. Pure regex over normalized OCR text.
 */

import type { ExtractedField } from "@/lib/extraction/extraction_pipeline_types";
import type { FieldExtractor } from "@/lib/extraction/field_extractors/extractor_types";
import { extractDate } from "@/lib/extraction/date_extraction";
import { validateThaiNationalId, validateIsoDate, validateRequired } from "@/lib/extraction/field_validation";

const ID_NUMBER_PATTERN = /\b(\d)\s?(\d{4})\s?(\d{5})\s?(\d{2})\s?(\d)\b/;
const THAI_NAME_PATTERN = /ชื่อ(?:-สกุล|ตัวและช[ื]?อสกุล)?\s*[:\s]*([ก-๙\s.]{3,60})/;
const ENGLISH_NAME_PATTERN = /(?:Name|NAME)\s*[:\s]*([A-Za-z\s.]{3,60})/;
const BIRTH_LABEL_PATTERN = /เกิดวันที่|วันเดือนปีเกิด|date of birth/i;
const ISSUE_LABEL_PATTERN = /วันออกบัตร|issue date/i;
const EXPIRY_LABEL_PATTERN = /วันบัตรหมดอายุ|วันหมดอายุ|expiry date|date of expiry/i;

/** Finds the first date pattern appearing within `windowChars` characters after a label match — a lightweight "date near this label" heuristic without a full layout parser. */
function dateNearLabel(text: string, labelPattern: RegExp, windowChars = 40): ReturnType<typeof extractDate> {
  const labelMatch = text.match(labelPattern);
  if (!labelMatch || labelMatch.index === undefined) return null;
  const windowText = text.slice(labelMatch.index, labelMatch.index + labelPattern.source.length + windowChars);
  return extractDate(windowText);
}

function dateField(code: string, label: string, extracted: ReturnType<typeof extractDate>): ExtractedField {
  if (!extracted) {
    return { code, label, rawValue: null, normalizedValue: null, normalizationReason: null, confidence: null, validation: validateRequired(null, label) };
  }
  const validation = extracted.normalizedValue ? validateIsoDate(extracted.normalizedValue) : { valid: false, warnings: [extracted.reason] };
  return {
    code,
    label,
    rawValue: extracted.rawValue,
    normalizedValue: extracted.normalizedValue,
    normalizationReason: extracted.reason,
    confidence: extracted.normalizedValue ? 0.75 : 0.3,
    validation,
  };
}

export const nationalIdExtractor: FieldExtractor = {
  documentType: "NATIONAL_ID",
  requiredFieldCodes: ["nationalId"],
  extract(normalizedText: string): ExtractedField[] {
    const fields: ExtractedField[] = [];

    const idMatch = normalizedText.match(ID_NUMBER_PATTERN);
    const idRaw = idMatch ? idMatch[0] : null;
    const idNormalized = idMatch ? idMatch.slice(1, 6).join("") : null;
    fields.push({
      code: "nationalId",
      label: "ID Number",
      rawValue: idRaw,
      normalizedValue: idNormalized,
      normalizationReason: idMatch ? "Grouped digits joined into a single 13-digit ID string." : null,
      confidence: idMatch ? 0.85 : null,
      validation: idNormalized ? validateThaiNationalId(idNormalized) : validateRequired(null, "ID Number"),
    });

    const thaiNameMatch = normalizedText.match(THAI_NAME_PATTERN);
    fields.push({
      code: "thaiName",
      label: "Thai Name",
      rawValue: thaiNameMatch ? thaiNameMatch[1].trim() : null,
      normalizedValue: thaiNameMatch ? thaiNameMatch[1].trim() : null,
      normalizationReason: null,
      confidence: thaiNameMatch ? 0.7 : null,
      validation: validateRequired(thaiNameMatch ? thaiNameMatch[1].trim() : null, "Thai Name"),
    });

    const englishNameMatch = normalizedText.match(ENGLISH_NAME_PATTERN);
    fields.push({
      code: "englishName",
      label: "English Name",
      rawValue: englishNameMatch ? englishNameMatch[1].trim() : null,
      normalizedValue: englishNameMatch ? englishNameMatch[1].trim() : null,
      normalizationReason: null,
      confidence: englishNameMatch ? 0.6 : null,
      validation: { valid: true, warnings: [] }, // optional field — absence is not a validation failure
    });

    fields.push(dateField("dateOfBirth", "Date of Birth", dateNearLabel(normalizedText, BIRTH_LABEL_PATTERN)));
    fields.push(dateField("issueDate", "Issue Date", dateNearLabel(normalizedText, ISSUE_LABEL_PATTERN)));
    fields.push(dateField("expiryDate", "Expiry Date", dateNearLabel(normalizedText, EXPIRY_LABEL_PATTERN)));

    return fields;
  },
};
