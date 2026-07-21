/**
 * Certificate-family field extractors (Phase 48 — spec §11): Training
 * Certificate, Education Certificate, Award Certificate. Grouped in one
 * file since they share the same "title + issuing organization + date +
 * optional certificate number" shape — three thin FieldExtractor instances
 * over that shared shape rather than three near-duplicate files.
 */

import type { ExtractedField } from "@/lib/extraction/extraction_pipeline_types";
import type { FieldExtractor } from "@/lib/extraction/field_extractors/extractor_types";
import { extractDate } from "@/lib/extraction/date_extraction";
import { validateIsoDate, validateRequired } from "@/lib/extraction/field_validation";

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
    confidence: extracted.normalizedValue ? 0.7 : 0.3,
    validation: extracted.normalizedValue ? validateIsoDate(extracted.normalizedValue) : { valid: false, warnings: [extracted.reason] },
  };
}

function textField(code: string, label: string, match: RegExpMatchArray | null, required: boolean): ExtractedField {
  const value = match ? match[1].trim() : null;
  return {
    code,
    label,
    rawValue: value,
    normalizedValue: value,
    normalizationReason: null,
    confidence: match ? 0.65 : null,
    validation: required ? validateRequired(value, label) : { valid: true, warnings: [] },
  };
}

const CERT_NUMBER_PATTERN = /(?:เลขที่|certificate no\.?|no\.?)\s*[:\s]*([A-Za-z0-9\-/]{3,20})/i;

export const trainingCertificateExtractor: FieldExtractor = {
  documentType: "TRAINING_CERTIFICATE",
  requiredFieldCodes: ["courseName"],
  extract(normalizedText: string): ExtractedField[] {
    const courseMatch = normalizedText.match(/(?:หลักสูตร|course)\s*[:\s]*([ก-๙A-Za-z0-9\s]{3,80})/i);
    const orgMatch = normalizedText.match(/(?:จัดโดย|issued by|organized by)\s*[:\s]*([ก-๙A-Za-z0-9\s]{3,80})/i);
    const completionDate = extractDate(normalizedText);
    const certNumberMatch = normalizedText.match(CERT_NUMBER_PATTERN);

    return [
      textField("courseName", "Course Name", courseMatch, true),
      textField("issuingOrganization", "Issuing Organization", orgMatch, false),
      dateField("completionDate", "Completion Date", completionDate),
      textField("certificateNumber", "Certificate Number", certNumberMatch, false),
    ];
  },
};

export const educationCertificateExtractor: FieldExtractor = {
  documentType: "EDUCATION_CERTIFICATE",
  requiredFieldCodes: ["qualification"],
  extract(normalizedText: string): ExtractedField[] {
    const qualificationMatch = normalizedText.match(/(?:วุฒิการศึกษา|ปริญญา|degree|diploma)\s*[:\s]*([ก-๙A-Za-z0-9\s]{3,80})/i);
    const institutionMatch = normalizedText.match(/(?:สถาบัน|มหาวิทยาลัย|university|institute)\s*[:\s]*([ก-๙A-Za-z0-9\s]{3,80})/i);
    const graduationDate = extractDate(normalizedText);
    const certNumberMatch = normalizedText.match(CERT_NUMBER_PATTERN);

    return [
      textField("qualification", "Qualification", qualificationMatch, true),
      textField("institution", "Institution", institutionMatch, false),
      dateField("graduationDate", "Graduation Date", graduationDate),
      textField("certificateNumber", "Certificate Number", certNumberMatch, false),
    ];
  },
};

export const awardExtractor: FieldExtractor = {
  documentType: "AWARD",
  requiredFieldCodes: ["awardName"],
  extract(normalizedText: string): ExtractedField[] {
    const awardMatch = normalizedText.match(/(?:เกียรติบัตร|certificate of|award)\s*[:\s]*([ก-๙A-Za-z0-9\s]{3,80})/i);
    const orgMatch = normalizedText.match(/(?:มอบโดย|issued by|awarded by)\s*[:\s]*([ก-๙A-Za-z0-9\s]{3,80})/i);
    const awardDate = extractDate(normalizedText);

    return [
      textField("awardName", "Award Name", awardMatch, true),
      textField("issuingOrganization", "Issuing Organization", orgMatch, false),
      dateField("awardDate", "Award Date", awardDate),
    ];
  },
};
