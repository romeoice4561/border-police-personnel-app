/**
 * Localize OfficerDocumentIntelligence labels for the active UI language.
 * Phase 49A.3 — dictionary-driven; does not change readiness calculations.
 */

import type { Language } from "@/lib/i18n/dictionary";
import { DICTIONARY, translate, type TranslationKey } from "@/lib/i18n/dictionary";
import { findDocumentType } from "@/lib/document/document_types";
import type {
  OfficerDocumentIntelligence,
  PrimaryAction,
} from "@/lib/integration/documents/document_intelligence_contract";
import type { ReadinessLevel } from "@/lib/intelligence/document_readiness";

const READINESS_KEY: Record<ReadinessLevel, TranslationKey> = {
  READY: "officer.readiness.ready",
  NEEDS_REVIEW: "officer.readiness.needsReview",
  INCOMPLETE: "officer.readiness.incomplete",
  BLOCKED: "officer.readiness.blocked",
  UNKNOWN: "officer.readiness.unknown",
};

const PRIMARY_ACTION_KEY: Record<PrimaryAction, TranslationKey> = {
  NONE: "officer.readiness.action.none",
  UPLOAD_MISSING: "officer.readiness.action.uploadMissing",
  REVIEW_EXPIRED: "officer.readiness.action.reviewExpired",
  REVIEW_EXPIRING: "officer.readiness.action.reviewExpiring",
  MANUAL_APPROVAL: "officer.readiness.action.manualApproval",
  RESOLVE_VALIDATION: "officer.readiness.action.resolveValidation",
  RETAKE_UNSUPPORTED: "officer.readiness.action.retakeUnsupported",
};

function checklistLabel(typeCode: string, language: Language): string | null {
  const key = `epf.completeness.checklist.${typeCode}` as TranslationKey;
  if (DICTIONARY[key]) return translate(key, language);
  const def = findDocumentType(typeCode);
  if (!def) return null;
  return language === "en" ? def.labelEn : def.labelTh;
}

export function localizedReadinessLabel(level: ReadinessLevel, language: Language): string {
  return translate(READINESS_KEY[level], language);
}

export function localizedPrimaryActionLabel(
  di: Pick<OfficerDocumentIntelligence, "primaryAction" | "missingRequiredDocuments">,
  language: Language
): string {
  if (di.primaryAction === "UPLOAD_MISSING" && di.missingRequiredDocuments.length === 1) {
    const label = checklistLabel(di.missingRequiredDocuments[0], language);
    if (label) return `${translate("epf.action.uploadMissingNamed", language)}${label}`;
  }
  return translate(PRIMARY_ACTION_KEY[di.primaryAction], language);
}

export function localizedMissingDocumentNames(typeCodes: readonly string[], language: Language): string[] {
  return typeCodes.map((code) => checklistLabel(code, language) ?? code);
}
