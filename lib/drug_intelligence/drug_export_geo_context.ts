/**
 * Map filter state → Export Context V1, and context → geographic query filter.
 * Map remains the filter source of truth. Lead org is never folded into reporting org.
 * caseId, viewport bounds, officer, and participating-unit filters are not report inputs.
 */

import type { DrugExportContextV1Input, ResolvedDrugExportContextV1 } from "@/lib/drug_intelligence/drug_export_context";
import { DRUG_CASE_STATUSES, isValidDrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_CATEGORIES, isValidDrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";
import type { DrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";
import type { GeographicReportQueryFilter } from "@/lib/drug_intelligence/drug_geographic_report_query";
import type { Language } from "@/lib/i18n/dictionary";

function optionalPositiveInt(value: number | null | undefined): number | undefined {
  if (value == null) return undefined;
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? undefined : trimmed;
}

function orgBlock(
  hqId: number | null | undefined,
  regionId: number | null | undefined,
  battalionId: number | null | undefined,
  companyId: number | null | undefined
): DrugExportContextV1Input["organization"] | undefined {
  const organization = {
    hqId: optionalPositiveInt(hqId),
    regionId: optionalPositiveInt(regionId),
    battalionId: optionalPositiveInt(battalionId),
    companyId: optionalPositiveInt(companyId),
  };
  if (
    organization.hqId == null &&
    organization.regionId == null &&
    organization.battalionId == null &&
    organization.companyId == null
  ) {
    return undefined;
  }
  return organization;
}

export function drugGeoFilterStateToExportContext(
  state: DrugGeoFilterState,
  locale: Language
): DrugExportContextV1Input {
  const dateFrom = optionalText(state.dateFrom);
  const dateTo = optionalText(state.dateTo);
  const period = dateFrom && dateTo ? { dateFrom, dateTo } : undefined;
  const status = optionalText(state.status);
  const drugCategory = optionalText(state.drugCategory);
  const personId = optionalText(state.personId);
  return {
    schemaVersion: 1,
    locale,
    sourceRoute: "/drug-intelligence/map",
    period,
    organization: orgBlock(state.headquartersId, state.regionId, state.battalionId, state.companyId),
    leadOrganization: orgBlock(state.leadHeadquartersId, state.leadRegionId, state.leadBattalionId, state.leadCompanyId),
    geo: {
      province: optionalText(state.province),
      district: optionalText(state.district),
      status: status && isValidDrugCaseStatus(status) ? status : undefined,
      drugCategory: drugCategory && isValidDrugCategory(drugCategory) ? drugCategory : undefined,
    },
    person: personId ? { personId } : undefined,
  };
}

export function exportContextToGeographicReportFilter(
  context: DrugExportContextV1Input | ResolvedDrugExportContextV1
): GeographicReportQueryFilter {
  const status = context.geo?.status;
  const drugCategory = context.geo?.drugCategory;
  return {
    dateFrom: context.period?.dateFrom,
    dateTo: context.period?.dateTo,
    fiscalYearBe: context.period?.fiscalYearBe,
    headquartersId: context.organization?.hqId,
    regionId: context.organization?.regionId,
    battalionId: context.organization?.battalionId,
    companyId: context.organization?.companyId,
    leadHeadquartersId: context.leadOrganization?.hqId,
    leadRegionId: context.leadOrganization?.regionId,
    leadBattalionId: context.leadOrganization?.battalionId,
    leadCompanyId: context.leadOrganization?.companyId,
    province: context.geo?.province,
    district: context.geo?.district,
    status: status && (DRUG_CASE_STATUSES as readonly string[]).includes(status) ? status : undefined,
    drugCategory: drugCategory && (DRUG_CATEGORIES as readonly string[]).includes(drugCategory) ? drugCategory : undefined,
    personId: context.person?.personId,
  };
}
