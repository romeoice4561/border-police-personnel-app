/**
 * Server-side export masking (DI-10B). Reuses on-screen identifier/phone
 * semantics. Never trust a client-supplied "already masked" value.
 */

import { hasPermission, type Permission } from "@/lib/auth/roles";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import type { DrugExportMaskingMode } from "@/lib/drug_intelligence/drug_export_types";

export function resolveExportMaskingMode(
  requested: DrugExportMaskingMode | undefined,
  permissions: readonly Permission[] | undefined
): { mode: DrugExportMaskingMode; allowed: boolean } {
  const wantsFull = requested === "FULL";
  const canViewFull = hasPermission(permissions, "drug.edit");
  if (wantsFull && !canViewFull) return { mode: "MASKED", allowed: false };
  return { mode: wantsFull ? "FULL" : "MASKED", allowed: true };
}

export function presentExportIdentifier(value: string | null | undefined, mode: DrugExportMaskingMode): string {
  if (value == null || value === "") return "";
  return presentIdentifierValue(value, mode === "FULL");
}

export function presentExportPhone(value: string | null | undefined, mode: DrugExportMaskingMode): string {
  if (value == null || value === "") return "";
  return presentPhoneNumber(value, mode === "FULL");
}
