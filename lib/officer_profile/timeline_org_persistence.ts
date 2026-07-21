/**
 * Timeline organization field persistence (Phase 49A.2B).
 *
 * Keeps structured org labels and the legacy free-text `unit` independent
 * through save → DB → hydrate. Never collapses company/battalion/region/
 * headquarters text into `unit` during save.
 */

import { formatThaiDate } from "@/lib/officer_profile/thai_date";
import { normalizeThaiPersonnelDateForSave } from "@/lib/officer_profile/thai_personnel_date";
import { normalizePositionLevel } from "@/lib/commander_query/position_level";

/** Draft slice required to build one timeline PATCH row. */
export interface TimelineOrgPersistenceDraft {
  year: string;
  rank: string;
  position: string;
  positionLevel: string;
  unit: string;
  source: string;
  verified: string;
  day: number | null;
  month: number | null;
  yearBE: number | null;
  appointmentCycle: number | null;
  isPresent: boolean;
  headquartersId: number | null;
  headquartersText: string;
  regionId: number | null;
  regionText: string;
  battalionId: number | null;
  battalionText: string;
  companyId: number | null;
  companyText: string;
  verificationStatus: string;
  verifiedBy: string;
  verifiedDate: string;
  verificationRemark: string;
}

/** One timeline row as sent on PATCH /api/officers/:id. */
export interface TimelineSaveRowPayload {
  sequence: number;
  year: string;
  yearValue: number | null;
  rank: string | null;
  position: string;
  positionLevel: string;
  unit: string | null;
  source: string | null;
  verified: string;
  day: number | null;
  month: number | null;
  yearBE: number | null;
  appointmentCycle: number | null;
  isPresent: boolean;
  headquartersId: number | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  headquartersText: string | null;
  regionText: string | null;
  battalionText: string | null;
  companyText: string | null;
  verificationStatus: string | null;
  verifiedBy: string | null;
  verifiedDate: string | null;
  verificationRemark: string | null;
}

/** Trims free text; blank → null (never invents a value). */
export function optionalOrgText(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Legacy `unit` persists exactly as entered.
 * Structured org labels must never overwrite this field during save.
 */
export function resolvePersistedLegacyUnit(unit: string): string | null {
  return optionalOrgText(unit);
}

/**
 * Hydrate display text: prefer the persisted label (exact round-trip), else
 * the id-resolved master label. Never invent values.
 */
export function hydrateOrgLabel(
  storedText: string | null | undefined,
  resolvedFromId: string | null | undefined
): string {
  const stored = optionalOrgText(storedText ?? undefined);
  if (stored) return stored;
  return resolvedFromId ?? "";
}

/** Prefer stored org label for read-only viewers; fall back to resolveLabels. */
export function displayOrgLabel(
  storedText: string | null | undefined,
  resolvedFromId: string | null | undefined
): string | null {
  const hydrated = hydrateOrgLabel(storedText, resolvedFromId);
  return hydrated.length > 0 ? hydrated : null;
}

/**
 * Builds one timeline PATCH row. Field X in → field X out — no cross-field
 * substitution between unit and structured org labels.
 */
export function serializeTimelineDraftForSave(
  row: TimelineOrgPersistenceDraft,
  sequence: number
): TimelineSaveRowPayload {
  const year = row.yearBE != null ? formatThaiDate(row) : row.year;
  return {
    sequence,
    year: year.trim() || "-",
    yearValue: row.yearBE ?? (/^\d+$/.test(row.year) ? Number(row.year) : null),
    rank: row.rank.trim() || null,
    position: row.position.trim() || "-",
    positionLevel: normalizePositionLevel(row.positionLevel),
    unit: resolvePersistedLegacyUnit(row.unit),
    source: row.source.trim() || null,
    verified: row.verified || "ยังไม่ตรวจ",
    day: row.day,
    month: row.month,
    yearBE: row.yearBE,
    appointmentCycle: row.appointmentCycle ?? row.yearBE,
    isPresent: row.isPresent,
    headquartersId: row.headquartersId,
    regionId: row.regionId,
    battalionId: row.battalionId,
    companyId: row.companyId,
    headquartersText: optionalOrgText(row.headquartersText),
    regionText: optionalOrgText(row.regionText),
    battalionText: optionalOrgText(row.battalionText),
    companyText: optionalOrgText(row.companyText),
    verificationStatus: row.verificationStatus || null,
    verifiedBy: row.verifiedBy.trim() || null,
    verifiedDate: normalizeThaiPersonnelDateForSave(row.verifiedDate),
    verificationRemark: row.verificationRemark.trim() || null,
  };
}
