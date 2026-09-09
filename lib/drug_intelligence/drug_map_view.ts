/**
 * DI-10E.6B — live Map V2 view helpers.
 *
 * Pure classification / pagination math. No I/O.
 */

import type { DrugMapWarningCode } from "@/lib/drug_intelligence/drug_map_query";

export function mapListTotalPages(total: number, pageSize: number): number {
  if (pageSize < 1) return 1;
  if (total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

export function isDrugMapHardLimit(warnings: readonly DrugMapWarningCode[] | readonly string[]): boolean {
  return warnings.includes("MARKER_LIMIT");
}

export function isDrugMapSoftLimit(warnings: readonly DrugMapWarningCode[] | readonly string[]): boolean {
  return warnings.includes("MARKER_SOFT_LIMIT");
}

export function isDrugMapTrueEmpty(totalCases: number): boolean {
  return totalCases === 0;
}
