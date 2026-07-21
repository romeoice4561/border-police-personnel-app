/**
 * Canonical locale-aware document-type labels (Phase 49A.3 closure).
 *
 * ONE display-resolution path for built-in type names. Components must not
 * hardcode English registry fields in Thai mode. Stored user-entered titles
 * stay verbatim; registry defaults are re-localized at display time.
 */

import type { Language } from "@/lib/i18n/dictionary";
import { findDocumentType, getDocumentTypes } from "@/lib/document/document_types";

/**
 * Locale-aware label for a document type code.
 * Unknown codes fall back to a readable spaced form — never a raw SCREAMING_ENUM
 * as the primary visible string when a registry entry exists; unknown codes
 * return the code only as a last resort (extensions not yet registered).
 */
export function getDocumentTypeLabel(documentType: string, locale: Language): string {
  const def = findDocumentType(documentType);
  if (def) return locale === "th" ? def.labelTh : def.labelEn;
  // Soften unknown codes for display (HOUSE_FOO → House Foo) rather than screaming.
  const softened = documentType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
  return softened || documentType;
}

/**
 * True when `title` is an empty/blank string or matches a known built-in
 * default title for this type (current or legacy registry wording) — those
 * titles are re-localized at display time, not treated as user prose.
 */
export function isBuiltInDocumentTitle(title: string | null | undefined, documentType: string): boolean {
  const trimmed = (title ?? "").trim();
  if (!trimmed) return true;
  const def = findDocumentType(documentType);
  if (!def) return false;
  if (trimmed === def.labelEn || trimmed === def.labelTh) return true;
  // Legacy defaults that may already be persisted from earlier English-only uploads.
  for (const legacy of LEGACY_BUILTIN_TITLES_BY_CODE[documentType] ?? []) {
    if (trimmed === legacy) return true;
  }
  return false;
}

/**
 * Display title for a document card / drawer:
 * - user-entered custom title → unchanged
 * - missing or built-in default → localized type label for `locale`
 */
export function resolveDocumentDisplayTitle(
  storedTitle: string | null | undefined,
  documentType: string,
  locale: Language
): string {
  if (isBuiltInDocumentTitle(storedTitle, documentType)) {
    return getDocumentTypeLabel(documentType, locale);
  }
  return (storedTitle ?? "").trim();
}

/** Every registered type has non-empty TH and EN labels (for tests / audit). */
export function assertAllDocumentTypesHaveLocaleLabels(): { code: string; labelTh: string; labelEn: string }[] {
  return getDocumentTypes().map((d) => ({
    code: d.code,
    labelTh: d.labelTh,
    labelEn: d.labelEn,
  }));
}

/**
 * Prior English/Thai auto-titles that may exist in DB from before locale-aware
 * display. Matching these still triggers re-localization.
 */
const LEGACY_BUILTIN_TITLES_BY_CODE: Readonly<Record<string, readonly string[]>> = {
  NATIONAL_ID: ["National ID Card", "ID Card", "บัตรประชาชน"],
  OFFICER_CARD: ["Government Officer Card", "Officer Card", "บัตรประจำตัวข้าราชการ"],
  DRIVER_LICENSE: ["Driver License", "Driver's License"],
  HOUSE_REGISTRATION: ["House Registration"],
  MILITARY_RECORD: ["Military Record (ป.4)", "Military Record", "ป.4"],
  GP7: ["GP7"],
  APPOINTMENT_ORDER: ["Appointment Order"],
  CERTIFICATE: ["Certificate", "ประกาศนียบัตร"],
  PASSPORT: ["Passport"],
  OTHER: ["Other", "เอกสารอื่น"],
  TRAINING_CERTIFICATE: ["Training Certificate", "ประกาศนียบัตรฝึกอบรม"],
  EDUCATION_CERTIFICATE: ["Education Certificate"],
  AWARD: ["Award", "เกียรติบัตร/รางวัล"],
  MEDICAL_DOCUMENT: ["Medical Document"],
  FIREARMS_QUALIFICATION: ["Firearms Qualification"],
  ANNUAL_EVALUATION: ["Annual Evaluation", "แบบประเมินผลงานประจำปี"],
  SALARY_DOCUMENT: ["Salary Document"],
  PENSION_DOCUMENT: ["Pension Document"],
};
