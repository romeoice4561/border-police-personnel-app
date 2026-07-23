/**
 * Report filter application (Phase 49C).
 *
 * Mirrors Commander Search equality rules for org/rank/priority/training/
 * retirement/document fields — never re-derives engine scores.
 */
import type { CommanderQueryOfficer, CommanderQueryOptions } from "@/lib/commander_query/types";
import type { ReportFilterState } from "@/lib/commander_reports/types";

function hasExpiringWarning(officer: CommanderQueryOfficer): boolean {
  return officer.documentExpiryInfo.some((info) => info.status === "expiring_soon");
}

function matchesDocumentStatus(officer: CommanderQueryOfficer, status: NonNullable<ReportFilterState["documentStatus"]>): boolean {
  const di = officer.documentIntelligence;
  if (status === "missing") return di.missingRequiredCount > 0;
  if (status === "expired") return di.expiredCount > 0;
  if (status === "warning") return hasExpiringWarning(officer);
  return di.missingRequiredCount === 0 && di.expiredCount === 0;
}

function matchesRetirementWithin(
  officer: CommanderQueryOfficer,
  within: NonNullable<ReportFilterState["retirementWithin"]>,
  asOf: Date
): boolean {
  if (officer.retirementYear == null) return false;
  const horizonYears = within === "within-1-year" ? 1 : within === "within-3-years" ? 3 : 5;
  const currentYear = asOf.getUTCFullYear();
  return officer.retirementYear - currentYear <= horizonYears;
}

/** Filters the already-loaded officer list. Pure — no I/O. */
export function applyReportFilters(
  officers: readonly CommanderQueryOfficer[],
  filters: ReportFilterState,
  asOf: Date = new Date()
): CommanderQueryOfficer[] {
  return officers.filter((row) => {
    if (filters.regionId != null && row.regionId !== filters.regionId) return false;
    if (filters.battalionId != null && row.battalionId !== filters.battalionId) return false;
    if (filters.companyId != null && row.companyId !== filters.companyId) return false;
    if (filters.rank && row.rank !== filters.rank) return false;
    if (filters.positionLevel && row.positionLevel !== filters.positionLevel) return false;
    if (filters.priority && row.priority !== filters.priority) return false;
    if (filters.readiness && row.documentIntelligence.readinessLevel !== filters.readiness) return false;
    if (filters.trainingStatus && row.trainingIntelligence.trainingStatus !== filters.trainingStatus) return false;
    if (filters.documentStatus && !matchesDocumentStatus(row, filters.documentStatus)) return false;
    if (filters.retirementWithin && !matchesRetirementWithin(row, filters.retirementWithin, asOf)) return false;
    // fiscalYear is presentation/metadata for most reports; retirementForecast
    // applies it in build_report's projection step — not as a global hard filter.
    return true;
  });
}

/** Human-readable Thai summary of active filters for cover/export headers. */
export function describeReportFiltersTh(
  filters: ReportFilterState,
  options: CommanderQueryOptions
): string {
  const parts: string[] = [];
  if (filters.regionId != null) {
    parts.push(`ภาค: ${options.regions.find((r) => r.id === filters.regionId)?.label ?? filters.regionId}`);
  }
  if (filters.battalionId != null) {
    parts.push(`กองกำกับการ: ${options.battalions.find((b) => b.id === filters.battalionId)?.label ?? filters.battalionId}`);
  }
  if (filters.companyId != null) {
    parts.push(`กองร้อย: ${options.companies.find((c) => c.id === filters.companyId)?.label ?? filters.companyId}`);
  }
  if (filters.rank) parts.push(`ยศ: ${filters.rank}`);
  if (filters.positionLevel) parts.push(`ระดับตำแหน่ง: ${filters.positionLevel}`);
  if (filters.priority) parts.push(`ความสำคัญ: ${filters.priority}`);
  if (filters.readiness) parts.push(`ความพร้อมเอกสาร: ${filters.readiness}`);
  if (filters.documentStatus) parts.push(`สถานะเอกสาร: ${filters.documentStatus}`);
  if (filters.trainingStatus) parts.push(`การฝึกอบรม: ${filters.trainingStatus}`);
  if (filters.retirementWithin) parts.push(`เกษียณ: ${filters.retirementWithin}`);
  if (filters.fiscalYear != null) parts.push(`ปีงบประมาณเป้าหมาย (ค.ศ. ${filters.fiscalYear})`);
  return parts.length > 0 ? parts.join(" · ") : "ทุกขอบเขต";
}
