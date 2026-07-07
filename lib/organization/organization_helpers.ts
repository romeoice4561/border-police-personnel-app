/**
 * Organization code parsing/validation helpers (Phase 20A).
 *
 * Pure functions that normalize and validate Region/Battalion/Company codes
 * from raw text (folder names, OCR unit strings, etc.) against the OFFICIAL
 * digit relationship: a company code's first digit is its region, and its
 * first two digits are its battalion code (e.g. company "447" belongs to
 * battalion "44", which belongs to region "4"). A code that doesn't fit this
 * relationship — or isn't present in the master hierarchy at all — is never
 * silently coerced into an organization record; callers get an explicit
 * unresolved result to route to the review list instead.
 *
 * No I/O, no DB, no globals — this module only knows how to parse and check
 * consistency, not what the "real" registered units are.
 */

import type { OrganizationCodeResolution } from "@/lib/organization/organization_types";

const THAI_DIGITS: Record<string, string> = {
  "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
  "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9",
};

function toArabic(value: string): string {
  return value.replace(/[๐-๙]/g, (d) => THAI_DIGITS[d] ?? d);
}

const REGION_PATTERN = /ภาค\s*([0-9๐-๙]+)/;
const COMPANY_PATTERN = /(?<!กก\.)ตชด\.\s*([0-9๐-๙]+)/;
const BATTALION_PATTERN = /กก\.\s*ตชด\.\s*([0-9๐-๙]+)/;

/** Normalizes a raw company code fragment (e.g. "447", "๔๔๗") to a 3-digit string, or null if malformed. */
export function normalizeCompanyCode(raw: string): string | null {
  const digits = toArabic(raw.trim());
  if (!/^[0-9]{3}$/.test(digits)) return null;
  return digits;
}

/** Normalizes a raw battalion code fragment to a 2-digit string, or null if malformed. */
export function normalizeBattalionCode(raw: string): string | null {
  const digits = toArabic(raw.trim());
  if (!/^[0-9]{2}$/.test(digits)) return null;
  return digits;
}

/** Normalizes a raw region code fragment to a bare digit string, or null if malformed. */
export function normalizeRegionCode(raw: string): string | null {
  const digits = toArabic(raw.trim());
  if (!/^[0-9]{1,2}$/.test(digits)) return null;
  return digits;
}

/** The battalion code implied by a company code — its first two digits (company "447" → battalion "44"). */
export function battalionCodeOfCompany(companyCode: string): string | null {
  const normalized = normalizeCompanyCode(companyCode);
  return normalized ? normalized.slice(0, 2) : null;
}

/** The region code implied by a battalion code — its first digit (battalion "44" → region "4"). */
export function regionCodeOfBattalion(battalionCode: string): string | null {
  const normalized = normalizeBattalionCode(battalionCode);
  return normalized ? normalized[0] : null;
}

/** True when a company code's implied battalion matches the given battalion code. */
export function isCompanyConsistentWithBattalion(companyCode: string, battalionCode: string): boolean {
  const impliedBattalion = battalionCodeOfCompany(companyCode);
  const normalizedBattalion = normalizeBattalionCode(battalionCode);
  return impliedBattalion !== null && normalizedBattalion !== null && impliedBattalion === normalizedBattalion;
}

/** True when a battalion code's implied region matches the given region code. */
export function isBattalionConsistentWithRegion(battalionCode: string, regionCode: string): boolean {
  const impliedRegion = regionCodeOfBattalion(battalionCode);
  const normalizedRegion = normalizeRegionCode(regionCode);
  return impliedRegion !== null && normalizedRegion !== null && impliedRegion === normalizedRegion;
}

/**
 * Extracts the most specific organization code found in a raw text fragment
 * (company > battalion > region), WITHOUT checking it against the seeded
 * master data — that membership check is the repository/service's job (it
 * knows which codes are actually registered). Returns an unresolved result
 * only when no recognizable pattern is present at all.
 */
export function parseOrganizationCode(raw: string): OrganizationCodeResolution {
  const text = raw.replace(/\s+/g, " ").trim();

  // Company is checked FIRST: a single string (e.g. an officer's currentUnit)
  // can legitimately contain both a company token ("ตชด.434") and a battalion
  // token ("กก.ตชด.43") together — the company is strictly more specific and
  // must win rather than the earlier-appearing pattern.
  const companyMatch = text.match(COMPANY_PATTERN);
  if (companyMatch) {
    const companyCode = normalizeCompanyCode(toArabic(companyMatch[1]));
    if (companyCode) {
      const battalionCode = battalionCodeOfCompany(companyCode);
      const regionCode = battalionCode ? regionCodeOfBattalion(battalionCode) : null;
      if (battalionCode && regionCode) {
        return { status: "resolved", level: "company", companyCode, battalionCode, regionCode };
      }
    }
    return { status: "unresolved", raw, reason: "Malformed company code" };
  }

  const battalionMatch = text.match(BATTALION_PATTERN);
  if (battalionMatch) {
    const battalionCode = normalizeBattalionCode(toArabic(battalionMatch[1]));
    if (battalionCode) {
      const regionCode = regionCodeOfBattalion(battalionCode);
      if (regionCode) return { status: "resolved", level: "battalion", battalionCode, regionCode };
    }
    return { status: "unresolved", raw, reason: "Malformed battalion code" };
  }

  const regionMatch = text.match(REGION_PATTERN);
  if (regionMatch) {
    const regionCode = normalizeRegionCode(toArabic(regionMatch[1]));
    if (regionCode) return { status: "resolved", level: "region", regionCode };
    return { status: "unresolved", raw, reason: "Malformed region code" };
  }

  return { status: "unresolved", raw, reason: "No recognizable organization code" };
}

export const REGION_DISPLAY_NAME = (code: string): string => `ภาค ${code}`;
export const BATTALION_DISPLAY_NAME = (code: string): string => `กก.ตชด.${code}`;
export const COMPANY_DISPLAY_NAME = (code: string): string => `ตชด.${code}`;
