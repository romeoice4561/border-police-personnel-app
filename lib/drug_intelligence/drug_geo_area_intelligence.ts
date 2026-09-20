/**
 * DI-8.2B — Area intelligence ranking (province / district).
 *
 * Builds on Map V2 province aggregates and marker-level date ranges.
 * Subdistrict is omitted until coverage justifies it.
 *
 * Pure — no I/O.
 */

import { toDateOnly } from "@/lib/drug_intelligence/drug_cross_case_connection";

export type DrugGeoAreaLevel = "PROVINCE" | "DISTRICT";

export interface DrugGeoAreaRankRow {
  level: DrugGeoAreaLevel;
  /** Display / filter value. */
  value: string;
  unspecified: boolean;
  eventCount: number;
  percentOfFiltered: number;
  withCoordinates: number;
  withoutCoordinates: number;
  earliestArrestDate: string | null;
  latestArrestDate: string | null;
}

export interface DrugGeoAreaSourceRow {
  province?: string | null;
  district?: string | null;
  arrestDate?: string | Date | null;
  hasCoordinates?: boolean;
}

export interface DrugGeoProvinceAggregate {
  province: string;
  unspecified: boolean;
  caseCount: number;
  withCoordinates: number;
}

export interface DrugGeoDistrictAggregate {
  district: string;
  unspecified: boolean;
  caseCount: number;
  withCoordinates: number;
}

const UNKNOWN_PROVINCE = "ไม่ระบุจังหวัด";
const UNKNOWN_DISTRICT = "ไม่ระบุอำเภอ";

function trimOrEmpty(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function enrichProvinceRanking(
  provinces: readonly DrugGeoProvinceAggregate[],
  markers: readonly DrugGeoAreaSourceRow[],
  totalCases: number,
): DrugGeoAreaRankRow[] {
  const dateByKey = dateRangeByKey(markers, (row) => {
    const p = trimOrEmpty(row.province);
    return p === "" ? "" : p;
  });

  return provinces.map((row) => {
    const key = row.unspecified ? "" : row.province;
    const dates = dateByKey.get(key);
    const withCoordinates = row.withCoordinates;
    const withoutCoordinates = Math.max(0, row.caseCount - withCoordinates);
    return {
      level: "PROVINCE" as const,
      value: row.unspecified ? UNKNOWN_PROVINCE : row.province,
      unspecified: row.unspecified,
      eventCount: row.caseCount,
      percentOfFiltered: totalCases > 0 ? Math.round((row.caseCount / totalCases) * 1000) / 10 : 0,
      withCoordinates,
      withoutCoordinates,
      earliestArrestDate: dates?.earliest ?? null,
      latestArrestDate: dates?.latest ?? null,
    };
  });
}

export function enrichDistrictRanking(
  districts: readonly DrugGeoDistrictAggregate[],
  markers: readonly DrugGeoAreaSourceRow[],
  totalCases: number,
): DrugGeoAreaRankRow[] {
  const dateByKey = dateRangeByKey(markers, (row) => {
    const d = trimOrEmpty(row.district);
    return d === "" ? "" : d;
  });

  return districts.map((row) => {
    const key = row.unspecified ? "" : row.district;
    const dates = dateByKey.get(key);
    const withCoordinates = row.withCoordinates;
    const withoutCoordinates = Math.max(0, row.caseCount - withCoordinates);
    return {
      level: "DISTRICT" as const,
      value: row.unspecified ? UNKNOWN_DISTRICT : row.district,
      unspecified: row.unspecified,
      eventCount: row.caseCount,
      percentOfFiltered: totalCases > 0 ? Math.round((row.caseCount / totalCases) * 1000) / 10 : 0,
      withCoordinates,
      withoutCoordinates,
      earliestArrestDate: dates?.earliest ?? null,
      latestArrestDate: dates?.latest ?? null,
    };
  });
}

/**
 * When the server has not yet returned district aggregates, derive a
 * descriptive ranking from the current marker population only (coordinate
 * cases). Percent is vs markerCount in that case.
 */
export function rankDistrictsFromMarkers(
  markers: readonly DrugGeoAreaSourceRow[],
  totalCases: number,
): DrugGeoAreaRankRow[] {
  const counts = new Map<string, { value: string; unspecified: boolean; caseCount: number; withCoordinates: number }>();
  for (const row of markers) {
    const raw = trimOrEmpty(row.district);
    const unspecified = raw === "";
    const key = unspecified ? "" : raw;
    const existing = counts.get(key);
    if (existing) {
      existing.caseCount += 1;
      if (row.hasCoordinates !== false) existing.withCoordinates += 1;
    } else {
      counts.set(key, {
        value: unspecified ? UNKNOWN_DISTRICT : raw,
        unspecified,
        caseCount: 1,
        withCoordinates: row.hasCoordinates !== false ? 1 : 0,
      });
    }
  }

  const aggregates: DrugGeoDistrictAggregate[] = [...counts.values()]
    .map((row) => ({
      district: row.value,
      unspecified: row.unspecified,
      caseCount: row.caseCount,
      withCoordinates: row.withCoordinates,
    }))
    .sort((a, b) => {
      if (a.caseCount !== b.caseCount) return b.caseCount - a.caseCount;
      if (a.unspecified !== b.unspecified) return a.unspecified ? 1 : -1;
      return a.district.localeCompare(b.district, "th");
    });

  return enrichDistrictRanking(aggregates, markers, totalCases > 0 ? totalCases : markers.length);
}

function dateRangeByKey(
  rows: readonly DrugGeoAreaSourceRow[],
  keyOf: (row: DrugGeoAreaSourceRow) => string,
): Map<string, { earliest: string | null; latest: string | null }> {
  const map = new Map<string, { earliest: string | null; latest: string | null }>();
  for (const row of rows) {
    const key = keyOf(row);
    const date = toDateOnly(row.arrestDate);
    if (!date) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { earliest: date, latest: date });
      continue;
    }
    if (!existing.earliest || date < existing.earliest) existing.earliest = date;
    if (!existing.latest || date > existing.latest) existing.latest = date;
  }
  return map;
}
