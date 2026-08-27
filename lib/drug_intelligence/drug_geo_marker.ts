/**
 * Drug Geo Marker view model (Phase DI-8, Section 6).
 *
 * Pure composition layer — mirrors officer_drug_arrest_performance.ts's
 * convention exactly: takes already-loaded rows (no I/O here) and produces
 * one flat, display-ready structured object per case. Reused by the map
 * popup, the synchronized result list, the province breakdown, and (per
 * Section 6's explicit intent) a future Commander Dashboard drill-down —
 * nothing here is map-library-specific.
 *
 * Pure — no I/O, no React, no Leaflet import.
 */

import { groupSeizedItemFacts, type OfficerDrugArrestSeizureGroup } from "@/lib/drug_intelligence/officer_drug_arrest_performance";
import type { DrugSeizedItemAnalyticsFacts } from "@/lib/drug_intelligence/drug_seized_item_analytics";
import { DRUG_CASE_STATUS_META, isValidDrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";

/** Seizure summary group — same unit-safe (drugCategory, measurementKind) grouping DI-7.7 established; never combines COUNT and MASS. */
export type DrugGeoSeizureGroup = OfficerDrugArrestSeizureGroup;

export interface DrugGeoPersonSummary {
  personId: string;
  primaryFullName: string;
}

export interface DrugGeoCaseMarker {
  caseId: string;
  caseNumber: string;
  title: string;
  status: string;
  statusLabelTh: string;
  arrestDate: Date | null;

  /** Present only when both coordinates resolved per the Section 7 precedence rule — a marker without both is never constructed (see resolveDrugGeoCoordinate). */
  latitude: number;
  longitude: number;
  /** Which source produced this marker's coordinates — for QA/debugging and Section 7's "document exact precedence" requirement; never shown as a claim of forensic precision in the UI. */
  coordinateSource: "CASE" | "ARREST_LOCATION";

  province: string | null;
  district: string | null;
  subdistrict: string | null;
  locationName: string | null;

  reportingUnitText: string | null;
  leadUnitText: string | null;

  suspectCount: number;
  personSummaries: DrugGeoPersonSummary[];

  seizedItems: DrugGeoSeizureGroup[];

  participatingUnitCount: number;
  officerCount: number;

  hasUnreviewedAlert: boolean;
}

/** A case with no resolvable marker coordinates — still surfaced (Section 20: never silently hidden), distinct from a marker. */
export interface DrugGeoNoCoordinateCase {
  caseId: string;
  caseNumber: string;
  title: string;
  status: string;
  statusLabelTh: string;
  arrestDate: Date | null;
  province: string | null;
  district: string | null;
  reportingUnitText: string | null;
}

export interface DrugGeoProvinceBreakdownRow {
  province: string;
  caseCount: number;
  markerCount: number;
  personCount: number;
  /** Top seizure group(s) recorded for this province's cases — "จำนวนคดีที่บันทึกไว้"-style wording only, never a concentration/risk claim (Section 26). */
  topSeizedItems: DrugGeoSeizureGroup[];
}

export interface DrugGeoSummary {
  totalCases: number;
  markerCount: number;
  noCoordinateCount: number;
  provinceCount: number;
}

export interface DrugGeoResult {
  summary: DrugGeoSummary;
  markers: DrugGeoCaseMarker[];
  noCoordinateCases: DrugGeoNoCoordinateCase[];
  provinceBreakdown: DrugGeoProvinceBreakdownRow[];
}

function statusLabel(status: string): string {
  return isValidDrugCaseStatus(status) ? DRUG_CASE_STATUS_META[status].labelTh : status;
}

/**
 * Section 7's deterministic coordinate precedence, applied to ONE case's
 * already-loaded facts:
 *   1. DrugCase.latitude/longitude if BOTH present
 *   2. else the case's ARREST_LOCATION DrugLocation's latitude/longitude if BOTH present
 *   3. else no marker (returns null)
 *
 * Never combines a latitude from one source with a longitude from the
 * other, and never falls back to a non-ARREST_LOCATION location role —
 * Section 7 explicitly asks for "primary arrest DrugLocation coordinates",
 * and ARREST_LOCATION is the one role that means that.
 */
export function resolveDrugGeoCoordinate(facts: {
  caseLatitude: number | null;
  caseLongitude: number | null;
  arrestLocationLatitude: number | null;
  arrestLocationLongitude: number | null;
}): { latitude: number; longitude: number; source: "CASE" | "ARREST_LOCATION" } | null {
  if (facts.caseLatitude !== null && facts.caseLongitude !== null) {
    return { latitude: facts.caseLatitude, longitude: facts.caseLongitude, source: "CASE" };
  }
  if (facts.arrestLocationLatitude !== null && facts.arrestLocationLongitude !== null) {
    return { latitude: facts.arrestLocationLatitude, longitude: facts.arrestLocationLongitude, source: "ARREST_LOCATION" };
  }
  return null;
}

export interface DrugGeoCaseFacts {
  caseId: string;
  caseNumber: string;
  title: string;
  status: string;
  arrestDate: Date | null;
  caseLatitude: number | null;
  caseLongitude: number | null;
  arrestLocationLatitude: number | null;
  arrestLocationLongitude: number | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  locationName: string | null;
  reportingUnitText: string | null;
  leadUnitText: string | null;
  persons: DrugGeoPersonSummary[];
  seizedItems: DrugSeizedItemAnalyticsFacts[];
  participatingUnitCount: number;
  officerCount: number;
  hasUnreviewedAlert: boolean;
}

/** Composes the full geographic result from already-loaded, already-filtered case facts (no I/O). */
export function composeDrugGeoResult(cases: DrugGeoCaseFacts[]): DrugGeoResult {
  const markers: DrugGeoCaseMarker[] = [];
  const noCoordinateCases: DrugGeoNoCoordinateCase[] = [];
  const provinces = new Map<string, { caseIds: Set<string>; markerCaseIds: Set<string>; personIds: Set<string>; seizedItems: DrugSeizedItemAnalyticsFacts[] }>();

  for (const c of cases) {
    const coord = resolveDrugGeoCoordinate(c);

    if (c.province) {
      const bucket = provinces.get(c.province) ?? { caseIds: new Set(), markerCaseIds: new Set(), personIds: new Set(), seizedItems: [] };
      bucket.caseIds.add(c.caseId);
      if (coord) bucket.markerCaseIds.add(c.caseId);
      for (const p of c.persons) bucket.personIds.add(p.personId);
      bucket.seizedItems.push(...c.seizedItems);
      provinces.set(c.province, bucket);
    }

    if (coord) {
      markers.push({
        caseId: c.caseId,
        caseNumber: c.caseNumber,
        title: c.title,
        status: c.status,
        statusLabelTh: statusLabel(c.status),
        arrestDate: c.arrestDate,
        latitude: coord.latitude,
        longitude: coord.longitude,
        coordinateSource: coord.source,
        province: c.province,
        district: c.district,
        subdistrict: c.subdistrict,
        locationName: c.locationName,
        reportingUnitText: c.reportingUnitText,
        leadUnitText: c.leadUnitText,
        suspectCount: c.persons.length,
        personSummaries: c.persons,
        seizedItems: groupSeizedItemFacts(c.seizedItems),
        participatingUnitCount: c.participatingUnitCount,
        officerCount: c.officerCount,
        hasUnreviewedAlert: c.hasUnreviewedAlert,
      });
    } else {
      noCoordinateCases.push({
        caseId: c.caseId,
        caseNumber: c.caseNumber,
        title: c.title,
        status: c.status,
        statusLabelTh: statusLabel(c.status),
        arrestDate: c.arrestDate,
        province: c.province,
        district: c.district,
        reportingUnitText: c.reportingUnitText,
      });
    }
  }

  const provinceBreakdown: DrugGeoProvinceBreakdownRow[] = [...provinces.entries()]
    .map(([province, bucket]) => ({
      province,
      caseCount: bucket.caseIds.size,
      markerCount: bucket.markerCaseIds.size,
      personCount: bucket.personIds.size,
      topSeizedItems: groupSeizedItemFacts(bucket.seizedItems),
    }))
    .sort((a, b) => b.caseCount - a.caseCount || a.province.localeCompare(b.province));

  return {
    summary: {
      totalCases: cases.length,
      markerCount: markers.length,
      noCoordinateCount: noCoordinateCases.length,
      provinceCount: provinces.size,
    },
    markers,
    noCoordinateCases,
    provinceBreakdown,
  };
}
