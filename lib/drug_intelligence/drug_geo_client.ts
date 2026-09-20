/**
 * Drug Map Intelligence — client-facing V2 types + fetch wrapper (DI-10E.6B).
 *
 * Live Map GET returns DrugMapQueryService shape plus list.totalPages.
 * Marker lat/lng are interactive-Map only. Relation-heavy fields are not
 * preloaded (persons / seizures / officers / alerts) — that is DI-10E.6C.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import type { DrugMapWarningCode } from "@/lib/drug_intelligence/drug_map_query";

export interface DrugGeoPersonSummaryView {
  personId: string;
  primaryFullName: string;
}

export interface DrugMapMarkerView {
  caseId: string;
  latitude: number;
  longitude: number;
  coordinateSource: "CASE" | "ARREST_LOCATION";
  caseNumber: string;
  arrestDate: string | null;
  arrestTime: string | null;
  province: string | null;
  district: string | null;
  status: string;
  locationName: string | null;
  reportingUnitText: string | null;
  leadUnitText: string | null;
}

export interface DrugMapListItemView {
  caseId: string;
  caseNumber: string;
  arrestDate: string | null;
  arrestTime: string | null;
  province: string | null;
  district: string | null;
  locationName: string | null;
  status: string;
  reportingUnitText: string | null;
  leadUnitText: string | null;
  hasCoordinates: boolean;
}

export interface DrugMapProvinceView {
  province: string;
  unspecified: boolean;
  caseCount: number;
  withCoordinates: number;
}

export interface DrugMapDistrictView {
  district: string;
  unspecified: boolean;
  caseCount: number;
  withCoordinates: number;
}

export interface DrugMapSummaryView {
  totalCases: number;
  withCoordinates: number;
  withoutCoordinates: number;
  markerCount: number;
  markerLimitReached: boolean;
  provinceCount: number;
  districtCount: number;
}

export interface DrugMapTemporalView {
  coverage: {
    total: number;
    withTime: number;
    withoutTime: number;
    coveragePercent: number;
  };
  weekdayFrequency: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, number>;
  timeBucketFrequency: Record<
    "H00_03" | "H03_06" | "H06_09" | "H09_12" | "H12_15" | "H15_18" | "H18_21" | "H21_24",
    number
  >;
  timeFilterActive: boolean;
}

export interface DrugMapListView {
  items: DrugMapListItemView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DrugMapResultView {
  summary: DrugMapSummaryView;
  temporal: DrugMapTemporalView;
  markers: DrugMapMarkerView[];
  list: DrugMapListView;
  provinces: DrugMapProvinceView[];
  districts: DrugMapDistrictView[];
  warnings: DrugMapWarningCode[];
  limits: {
    markerSoft: number;
    markerHard: number;
    listDefaultPageSize: number;
    listMaxPageSize: number;
  };
}

export interface DrugGeoQueryParams {
  status?: string;
  province?: string;
  district?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  dateFrom?: string;
  dateTo?: string;
  arrestDateFrom?: string;
  arrestDateTo?: string;
  weekdays?: string;
  timePreset?: string;
  timeFrom?: string;
  timeTo?: string;
  leadHeadquartersId?: number;
  leadRegionId?: number;
  leadBattalionId?: number;
  leadCompanyId?: number;
  drugCategory?: string;
  personId?: string;
  page?: number;
  pageSize?: number;
}

export function drugGeoQueryToSearchParams(actorId: string, query: DrugGeoQueryParams): URLSearchParams {
  const search = new URLSearchParams();
  search.set("actorId", actorId);
  const mapped: Record<string, unknown> = {
    ...query,
    dateFrom: query.dateFrom || query.arrestDateFrom,
    dateTo: query.dateTo || query.arrestDateTo,
  };
  delete mapped.arrestDateFrom;
  delete mapped.arrestDateTo;
  delete mapped.caseId;
  for (const [key, value] of Object.entries(mapped)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  return search;
}

export async function fetchDrugGeoResult(actorId: string, query: DrugGeoQueryParams): Promise<DrugMapResultView> {
  let response: Response;
  try {
    response = await fetch(`/api/drug-intelligence/map?${drugGeoQueryToSearchParams(actorId, query).toString()}`, {
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    throw new ApiClientError("Network error — the server could not be reached.", 0, "NETWORK_ERROR", cause);
  }

  let body: { data?: DrugMapResultView; error?: { code: string; message: string; details?: unknown } };
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status, "BAD_RESPONSE");
  }

  if (!response.ok || body.error) {
    const err = body.error;
    throw new ApiClientError(err?.message ?? `Request failed (${response.status})`, response.status, err?.code ?? "REQUEST_FAILED", err?.details);
  }

  return body.data as DrugMapResultView;
}
