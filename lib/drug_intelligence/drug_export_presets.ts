/**
 * DI-10B export presets. Masking is independent of preset.
 * INTELLIGENCE does not unmask identifiers. CUSTOM cannot exceed the
 * permission-max / type-max column set.
 */

import {
  DRUG_EXPORT_RESTRICTED_COLUMNS,
  OPERATIONAL_CASES_COLUMNS,
  type DrugExportPreset,
  type DrugExportType,
} from "@/lib/drug_intelligence/drug_export_types";

const RESTRICTED = new Set<string>(DRUG_EXPORT_RESTRICTED_COLUMNS);

export function allowedColumnsForExportType(exportType: DrugExportType): readonly string[] {
  if (exportType === "OPERATIONAL_CASES") return OPERATIONAL_CASES_COLUMNS.map((c) => c.key);
  return [];
}

export function columnsForPreset(exportType: DrugExportType, preset: DrugExportPreset, custom?: readonly string[]): string[] {
  const allowed = allowedColumnsForExportType(exportType);
  if (allowed.length === 0) return [];
  if (preset === "MINIMAL") {
    return allowed.filter((key) => key === "caseId" || key === "caseNumber" || key === "status" || key === "arrestDate");
  }
  if (preset === "CUSTOM" && custom && custom.length > 0) {
    return custom.filter((key) => allowed.includes(key) && !RESTRICTED.has(key));
  }
  return [...allowed];
}

export function assertExportColumnsAllowed(columns: readonly string[]): string[] {
  return columns.filter((key) => RESTRICTED.has(key));
}
