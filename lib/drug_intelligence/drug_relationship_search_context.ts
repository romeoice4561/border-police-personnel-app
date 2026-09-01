/**
 * Relationship Search query-context presentation (Phase 1B.2.3).
 * Distinguishes original search input from resolved entity — presentation only.
 * No DB columns; never treats raw query text as a factual graph edge.
 */

import type { DrugSearchMatchedField } from "@/lib/drug_intelligence/drug_intelligence_client";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import type { TranslationKey } from "@/lib/i18n/dictionary";

/** Client-only query context attached when an officer picks a source via Search. */
export interface DrugRelationshipSourceQueryContext {
  /** Raw typed query — presentation only; never written as FACT. */
  queryText: string;
  /** Authoritative match field from Search API when available. */
  matchedField?: DrugSearchMatchedField;
  /** Already policy-masked matched value from Search API when available. */
  matchedValueMasked?: string;
}

const SESSION_KEY = "di.rel.sourceQueryContext.v1";

export type DrugRelationshipStoredQueryContext = DrugRelationshipSourceQueryContext & {
  sourceId: string;
};

/** Maps authoritative matchedField → "ค้นจาก …" field label key. Never invents citizen-ID when only IDENTIFIER is known. */
export const DRUG_REL_SEARCHED_FROM_FIELD_KEY: Partial<Record<DrugSearchMatchedField, TranslationKey>> = {
  PRIMARY_NAME: "di.rel.contextFieldPersonName",
  ALIAS: "di.rel.contextFieldPersonName",
  IDENTIFIER: "di.rel.contextFieldIdentifier",
  PHONE_NUMBER: "di.rel.contextFieldPhone",
  ICCID: "di.rel.contextFieldSim",
  IMSI: "di.rel.contextFieldSim",
  IMEI: "di.rel.contextFieldDevice",
  SERIAL_NUMBER: "di.rel.contextFieldDevice",
  REGISTRATION_NUMBER: "di.rel.contextFieldVehicle",
  VIN: "di.rel.contextFieldVehicle",
  CASE_NUMBER: "di.rel.contextFieldCaseNumber",
  CASE_TITLE: "di.rel.contextFieldCaseTitle",
};

export function searchedFromFieldLabelKey(
  matchedField: DrugSearchMatchedField | undefined
): TranslationKey {
  if (!matchedField) return "di.rel.contextFieldQuery";
  return DRUG_REL_SEARCHED_FROM_FIELD_KEY[matchedField] ?? "di.rel.contextFieldQuery";
}

/**
 * Display value for "ค้นจาก" — prefers API-masked matchedValueMasked.
 * Falls back to queryText with existing masking helpers (never invents match field).
 */
export function presentSourceQueryDisplayValue(
  ctx: DrugRelationshipSourceQueryContext | null | undefined,
  canViewFull: boolean
): string | null {
  if (!ctx) return null;
  if (ctx.matchedValueMasked && ctx.matchedValueMasked.trim()) {
    return ctx.matchedValueMasked.trim();
  }
  const raw = ctx.queryText.trim();
  if (!raw) return null;
  const field = ctx.matchedField;
  if (field === "PHONE_NUMBER") return presentPhoneNumber(raw, canViewFull);
  if (
    field === "IDENTIFIER" ||
    field === "ICCID" ||
    field === "IMSI" ||
    field === "IMEI" ||
    field === "SERIAL_NUMBER" ||
    field === "VIN"
  ) {
    return presentIdentifierValue(raw, canViewFull);
  }
  // Unknown match field: still mask digit-heavy sensitive-looking input.
  if (!field && looksLikeSensitiveIdentifier(raw)) {
    return presentIdentifierValue(raw, canViewFull);
  }
  if (!field && looksLikePhone(raw)) {
    return presentPhoneNumber(raw, canViewFull);
  }
  return raw;
}

export function looksLikeSensitiveIdentifier(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length / Math.max(value.replace(/\s/g, "").length, 1) >= 0.8;
}

export function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 12;
}

export function saveSourceQueryContext(sourceId: string, ctx: DrugRelationshipSourceQueryContext): void {
  if (typeof window === "undefined" || !sourceId) return;
  const payload: DrugRelationshipStoredQueryContext = { sourceId, ...ctx };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function loadSourceQueryContext(sourceId: string): DrugRelationshipSourceQueryContext | null {
  if (typeof window === "undefined" || !sourceId) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DrugRelationshipStoredQueryContext;
    if (!parsed || parsed.sourceId !== sourceId) return null;
    return {
      queryText: typeof parsed.queryText === "string" ? parsed.queryText : "",
      matchedField: parsed.matchedField,
      matchedValueMasked: parsed.matchedValueMasked,
    };
  } catch {
    return null;
  }
}

export function clearSourceQueryContext(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** True when URL-safe return paths must not embed raw query text. */
export function assertNoRawQueryInReturnPath(returnPath: string, rawQuery: string | undefined): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;
  const trimmed = rawQuery.trim();
  if (trimmed.length < 4) return true;
  try {
    return !decodeURIComponent(returnPath).includes(trimmed);
  } catch {
    return !returnPath.includes(trimmed);
  }
}
