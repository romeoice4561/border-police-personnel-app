/**
 * Drug Geo Intelligence — client-facing types + fetch wrapper (Phase DI-8).
 * Mirrors DrugCaseListRow/officer_drug_arrest_performance_client.ts's own
 * convention exactly: every Date becomes an ISO string, one thin fetch
 * wrapper reusing the SAME { data, meta } / { error } envelope + typed
 * ApiClientError every other Drug Intelligence client function uses.
 */

import { ApiClientError } from "@/lib/ui/api_client";
import type { DrugGeoSeizureGroup } from "@/lib/drug_intelligence/drug_geo_marker";

export type { DrugGeoSeizureGroup };

export interface DrugGeoPersonSummaryView {
  personId: string;
  primaryFullName: string;
}

export interface DrugGeoCaseMarkerView {
  caseId: string;
  caseNumber: string;
  title: string;
  status: string;
  statusLabelTh: string;
  arrestDate: string | null;
  latitude: number;
  longitude: number;
  coordinateSource: "CASE" | "ARREST_LOCATION";
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  locationName: string | null;
  reportingUnitText: string | null;
  leadUnitText: string | null;
  suspectCount: number;
  personSummaries: DrugGeoPersonSummaryView[];
  seizedItems: DrugGeoSeizureGroup[];
  participatingUnitCount: number;
  officerCount: number;
  hasUnreviewedAlert: boolean;
}

export interface DrugGeoNoCoordinateCaseView {
  caseId: string;
  caseNumber: string;
  title: string;
  status: string;
  statusLabelTh: string;
  arrestDate: string | null;
  province: string | null;
  district: string | null;
  reportingUnitText: string | null;
}

export interface DrugGeoProvinceBreakdownRowView {
  province: string;
  caseCount: number;
  markerCount: number;
  personCount: number;
  topSeizedItems: DrugGeoSeizureGroup[];
}

export interface DrugGeoSummaryView {
  totalCases: number;
  markerCount: number;
  noCoordinateCount: number;
  provinceCount: number;
}

export interface DrugGeoResultView {
  summary: DrugGeoSummaryView;
  markers: DrugGeoCaseMarkerView[];
  noCoordinateCases: DrugGeoNoCoordinateCaseView[];
  provinceBreakdown: DrugGeoProvinceBreakdownRowView[];
}

export interface DrugGeoQueryParams {
  status?: string;
  province?: string;
  district?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  arrestDateFrom?: string;
  arrestDateTo?: string;
  leadHeadquartersId?: number;
  leadRegionId?: number;
  leadBattalionId?: number;
  leadCompanyId?: number;
  drugCategory?: string;
  personId?: string;
  caseId?: string;
}

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export async function fetchDrugGeoResult(actorId: string, query: DrugGeoQueryParams): Promise<DrugGeoResultView> {
  let response: Response;
  try {
    response = await fetch(`/api/drug-intelligence/map${toQueryString({ actorId, ...query })}`, { headers: { Accept: "application/json" } });
  } catch (cause) {
    throw new ApiClientError("Network error — the server could not be reached.", 0, "NETWORK_ERROR", cause);
  }

  let body: { data?: DrugGeoResultView; error?: { code: string; message: string; details?: unknown } };
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status, "BAD_RESPONSE");
  }

  if (!response.ok || body.error) {
    const err = body.error;
    throw new ApiClientError(err?.message ?? `Request failed (${response.status})`, response.status, err?.code ?? "REQUEST_FAILED", err?.details);
  }

  return body.data as DrugGeoResultView;
}
