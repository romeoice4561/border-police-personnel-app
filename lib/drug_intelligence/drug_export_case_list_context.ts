/**
 * Case-list filter state → Export Context V1.
 * One adapter so the list UI, preview, and download share the same scope.
 */

import type { DrugExportContextV1Input } from "@/lib/drug_intelligence/drug_export_context";
import type { CaseCompletenessFilter } from "@/lib/drug_intelligence/drug_case_completeness";
import { DRUG_CASE_STATUSES } from "@/lib/drug_intelligence/drug_case_options";
import type { CommanderUnitGroupBy } from "@/lib/drug_intelligence/drug_commander_filter";
import type { Language } from "@/lib/i18n/dictionary";

export interface CaseListExportFilters {
  query?: string;
  arrestDateFrom?: string;
  arrestDateTo?: string;
  fiscalYearBe?: number;
  province?: string;
  status?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  completeness?: CaseCompletenessFilter;
  unitGroup?: CommanderUnitGroupBy;
}

export function caseListFiltersToExportContext(
  filters: CaseListExportFilters,
  locale: Language
): DrugExportContextV1Input {
  const hasDates = Boolean(filters.arrestDateFrom && filters.arrestDateTo);
  const period =
    hasDates || filters.fiscalYearBe != null
      ? {
          fiscalYearBe: filters.fiscalYearBe,
          dateFrom: hasDates ? filters.arrestDateFrom : undefined,
          dateTo: hasDates ? filters.arrestDateTo : undefined,
        }
      : undefined;
  return {
    schemaVersion: 1,
    locale,
    sourceRoute: "/drug-intelligence/cases",
    searchQuery: filters.query?.trim() || undefined,
    period,
    organization: {
      hqId: filters.headquartersId,
      regionId: filters.regionId,
      battalionId: filters.battalionId,
      companyId: filters.companyId,
    },
    geo: {
      province: filters.province || undefined,
      status: filters.status && (DRUG_CASE_STATUSES as readonly string[]).includes(filters.status)
        ? (filters.status as (typeof DRUG_CASE_STATUSES)[number])
        : undefined,
    },
    completeness: filters.completeness,
    unitGroup: filters.unitGroup,
  };
}
