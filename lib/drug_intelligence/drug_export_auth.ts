/**
 * DI-10B export authorization. Browse (`drug.read`) is not enough.
 * Unmasked identifiers additionally require `drug.edit`.
 * Board ownership is NOT baked in here — later board exporters add it.
 */

import { hasPermission, type Permission } from "@/lib/auth/roles";

export interface DrugExportAccess {
  canExport: boolean;
  canViewFull: boolean;
}

export function resolveDrugExportAccess(permissions: readonly Permission[] | undefined): DrugExportAccess {
  return {
    canExport: hasPermission(permissions, "drug.read") && hasPermission(permissions, "drug.export"),
    canViewFull: hasPermission(permissions, "drug.edit"),
  };
}

export function requireDrugExport(permissions: readonly Permission[] | undefined): DrugExportAccess | null {
  const access = resolveDrugExportAccess(permissions);
  return access.canExport ? access : null;
}
