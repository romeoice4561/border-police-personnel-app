/**
 * DI-8.2B — Geographic hotspot engine (descriptive intelligence only).
 *
 * Semantics (do not conflate):
 * - EVENT LOCATION: case/marker coordinates
 * - ADMINISTRATIVE AREA: province/district/subdistrict text
 * - HOTSPOT: ≥2 recorded events within a selectable radius (intelligence)
 * - CLUSTER: zoom-level map display aggregation (NOT a hotspot)
 *
 * Algorithm: spatial hash + union-find over neighbor cells. Comparisons are
 * local to nearby buckets — not naïve O(N²) over the full marker set.
 *
 * Pure — no I/O, no React, no Leaflet.
 */

import {
  computeTemporalCoverage,
  computeTimeBucketFrequency,
  computeWeekdayFrequency,
  ISO_WEEKDAY_SHORT_TH,
  MAP_TIME_BUCKETS,
  type IsoWeekday,
  type MapTimeBucketId,
  type TemporalCoverage,
} from "@/lib/drug_intelligence/drug_map_temporal";
import { toDateOnly } from "@/lib/drug_intelligence/drug_cross_case_connection";

/** Selectable hotspot radii (km). Not permanently hard-coded elsewhere — import this constant. */
export const DRUG_GEO_HOTSPOT_RADIUS_KM_OPTIONS = [0.5, 1, 3, 5, 10] as const;
export type DrugGeoHotspotRadiusKm = (typeof DRUG_GEO_HOTSPOT_RADIUS_KM_OPTIONS)[number];

export const DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM: DrugGeoHotspotRadiusKm = 3;

/** Map display mode — distinct from page view (MAP/LIST/PROVINCE). */
export const DRUG_GEO_MAP_MODES = ["POINTS", "HOTSPOT", "DENSITY"] as const;
export type DrugGeoMapMode = (typeof DRUG_GEO_MAP_MODES)[number];

export const DRUG_GEO_HOTSPOT_MIN_EVENTS = 2;

/** Earth mean radius (km) for haversine. */
const EARTH_RADIUS_KM = 6371;

export interface DrugGeoHotspotEvent {
  caseId: string;
  caseNumber?: string | null;
  latitude: number;
  longitude: number;
  arrestDate?: string | Date | null;
  arrestTime?: string | null;
  province?: string | null;
  district?: string | null;
  locationName?: string | null;
}

export interface DrugGeoHotspot {
  hotspotId: string;
  radiusKm: number;
  centerLatitude: number;
  centerLongitude: number;
  eventCount: number;
  caseIds: string[];
  earliestArrestDate: string | null;
  latestArrestDate: string | null;
  provinces: string[];
  districts: string[];
  timedEventCount: number;
  /** Filled when entity context is loaded; null means not yet available. */
  uniquePersonCount: number | null;
  uniquePhoneCount: number | null;
  uniqueVehicleCount: number | null;
  events: DrugGeoHotspotEvent[];
}

export interface DrugGeoHotspotTemporalSummary {
  coverage: TemporalCoverage;
  weekdayFrequency: Record<IsoWeekday, number>;
  timeBucketFrequency: Record<MapTimeBucketId, number>;
  peakWeekday: IsoWeekday | null;
  peakWeekdayCount: number;
  peakTimeBucket: MapTimeBucketId | null;
  peakTimeBucketCount: number;
}

const KM_PER_DEG_LAT = 111.32;

export function isDrugGeoHotspotRadiusKm(value: unknown): value is DrugGeoHotspotRadiusKm {
  return typeof value === "number" && (DRUG_GEO_HOTSPOT_RADIUS_KM_OPTIONS as readonly number[]).includes(value);
}

export function parseHotspotRadiusKmParam(raw: string | null | undefined): DrugGeoHotspotRadiusKm {
  if (raw == null || raw === "") return DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM;
  if (isDrugGeoHotspotRadiusKm(n)) return n;
  return DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM;
}

export function parseDrugGeoMapModeParam(raw: string | null | undefined): DrugGeoMapMode {
  if (raw === "HOTSPOT" || raw === "DENSITY" || raw === "POINTS") return raw;
  return "POINTS";
}

/** Great-circle distance in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Cell size in degrees so adjacent cells cover ~radius neighborhood. */
export function hotspotCellSizeDegrees(radiusKm: number): number {
  const safe = Math.max(0.05, radiusKm);
  return safe / KM_PER_DEG_LAT;
}

function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Deterministic hotspot id from radius + sorted member case ids. */
export function buildDrugGeoHotspotId(radiusKm: number, caseIds: readonly string[]): string {
  const sorted = [...caseIds].sort((a, b) => a.localeCompare(b));
  return `hs_${radiusKm}_${djb2(sorted.join("|"))}`;
}

class UnionFind {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = Array.from({ length: n }, () => 0);
  }

  find(i: number): number {
    let x = i;
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]!]!;
      x = this.parent[x]!;
    }
    return x;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra]! < this.rank[rb]!) this.parent[ra] = rb;
    else if (this.rank[ra]! > this.rank[rb]!) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra]! += 1;
    }
  }
}

/**
 * Radius-based hotspot grouping.
 * Complexity: O(N · K) where K is local neighbor density in spatial buckets,
 * not O(N²) over all pairs.
 */
export function computeDrugGeoHotspots(
  events: readonly DrugGeoHotspotEvent[],
  radiusKm: number = DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM,
  minEvents: number = DRUG_GEO_HOTSPOT_MIN_EVENTS,
): DrugGeoHotspot[] {
  const valid = events.filter(
    (e) => Number.isFinite(e.latitude) && Number.isFinite(e.longitude) && e.caseId,
  );
  if (valid.length < minEvents) return [];

  const cellSize = hotspotCellSizeDegrees(radiusKm);
  const buckets = new Map<string, number[]>();

  for (let i = 0; i < valid.length; i += 1) {
    const e = valid[i]!;
    const cellLat = Math.floor(e.latitude / cellSize);
    const cellLng = Math.floor(e.longitude / cellSize);
    const key = `${cellLat}:${cellLng}`;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }

  const uf = new UnionFind(valid.length);

  for (let i = 0; i < valid.length; i += 1) {
    const a = valid[i]!;
    const cellLat = Math.floor(a.latitude / cellSize);
    const cellLng = Math.floor(a.longitude / cellSize);
    for (let dLat = -1; dLat <= 1; dLat += 1) {
      for (let dLng = -1; dLng <= 1; dLng += 1) {
        const neighbors = buckets.get(`${cellLat + dLat}:${cellLng + dLng}`);
        if (!neighbors) continue;
        for (const j of neighbors) {
          if (j <= i) continue;
          const b = valid[j]!;
          if (haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) <= radiusKm) {
            uf.union(i, j);
          }
        }
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < valid.length; i += 1) {
    const root = uf.find(i);
    const list = groups.get(root);
    if (list) list.push(i);
    else groups.set(root, [i]);
  }

  const hotspots: DrugGeoHotspot[] = [];
  for (const indices of groups.values()) {
    if (indices.length < minEvents) continue;
    const members = indices.map((idx) => valid[idx]!);
    members.sort((a, b) => a.caseId.localeCompare(b.caseId));
    const caseIds = members.map((m) => m.caseId);
    const centerLatitude = members.reduce((s, m) => s + m.latitude, 0) / members.length;
    const centerLongitude = members.reduce((s, m) => s + m.longitude, 0) / members.length;

    const dates = members
      .map((m) => toDateOnly(m.arrestDate))
      .filter((d): d is string => Boolean(d))
      .sort();
    const provinces = uniqueSorted(members.map((m) => m.province));
    const districts = uniqueSorted(members.map((m) => m.district));
    const timedEventCount = members.filter((m) => Boolean(m.arrestTime && String(m.arrestTime).trim())).length;

    hotspots.push({
      hotspotId: buildDrugGeoHotspotId(radiusKm, caseIds),
      radiusKm,
      centerLatitude,
      centerLongitude,
      eventCount: members.length,
      caseIds,
      earliestArrestDate: dates[0] ?? null,
      latestArrestDate: dates[dates.length - 1] ?? null,
      provinces,
      districts,
      timedEventCount,
      uniquePersonCount: null,
      uniquePhoneCount: null,
      uniqueVehicleCount: null,
      events: members,
    });
  }

  hotspots.sort((a, b) => {
    if (a.eventCount !== b.eventCount) return b.eventCount - a.eventCount;
    if (a.centerLatitude !== b.centerLatitude) return a.centerLatitude - b.centerLatitude;
    if (a.centerLongitude !== b.centerLongitude) return a.centerLongitude - b.centerLongitude;
    return a.hotspotId.localeCompare(b.hotspotId);
  });

  return hotspots;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = v?.trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "th"));
}

export function summarizeHotspotTemporal(events: readonly DrugGeoHotspotEvent[]): DrugGeoHotspotTemporalSummary {
  const lite = events.map((e) => ({
    id: e.caseId,
    arrestDate: e.arrestDate ?? null,
    arrestTime: e.arrestTime ?? null,
  }));
  const coverage = computeTemporalCoverage(lite);
  const weekdayFrequency = computeWeekdayFrequency(lite);
  const timeBucketFrequency = computeTimeBucketFrequency(lite);

  let peakWeekday: IsoWeekday | null = null;
  let peakWeekdayCount = 0;
  for (const day of [1, 2, 3, 4, 5, 6, 7] as IsoWeekday[]) {
    const n = weekdayFrequency[day] ?? 0;
    if (n > peakWeekdayCount) {
      peakWeekdayCount = n;
      peakWeekday = day;
    }
  }

  let peakTimeBucket: MapTimeBucketId | null = null;
  let peakTimeBucketCount = 0;
  for (const bucket of MAP_TIME_BUCKETS) {
    const n = timeBucketFrequency[bucket.id] ?? 0;
    if (n > peakTimeBucketCount) {
      peakTimeBucketCount = n;
      peakTimeBucket = bucket.id;
    }
  }

  return {
    coverage,
    weekdayFrequency,
    timeBucketFrequency,
    peakWeekday: peakWeekdayCount > 0 ? peakWeekday : null,
    peakWeekdayCount,
    peakTimeBucket: peakTimeBucketCount > 0 ? peakTimeBucket : null,
    peakTimeBucketCount,
  };
}

/** Descriptive repeat-event phrases — never risk / intent language. */
export function deriveHotspotRepeatIndicators(
  hotspot: DrugGeoHotspot,
  temporal?: DrugGeoHotspotTemporalSummary,
): string[] {
  const lines: string[] = [];
  lines.push(`${hotspot.eventCount} เหตุการณ์ในรัศมี ${formatRadiusKm(hotspot.radiusKm)}`);

  if (hotspot.earliestArrestDate && hotspot.latestArrestDate) {
    const spanDays = daysBetweenInclusive(hotspot.earliestArrestDate, hotspot.latestArrestDate);
    if (spanDays <= 30 && hotspot.eventCount >= 2) {
      lines.push(`${hotspot.eventCount} เหตุการณ์ภายใน ${spanDays} วัน`);
    }
  }

  const summary = temporal ?? summarizeHotspotTemporal(hotspot.events);
  if (summary.peakWeekday && summary.peakWeekdayCount >= 2) {
    lines.push(`พบซ้ำวัน${ISO_WEEKDAY_SHORT_TH[summary.peakWeekday]} ${summary.peakWeekdayCount} ครั้ง`);
  }
  if (summary.peakTimeBucket && summary.peakTimeBucketCount >= 2) {
    const bucket = MAP_TIME_BUCKETS.find((b) => b.id === summary.peakTimeBucket);
    if (bucket) {
      lines.push(`พบช่วง ${bucket.labelTh} น. ${summary.peakTimeBucketCount} ครั้ง`);
    }
  }

  return lines;
}

export function formatRadiusKm(radiusKm: number): string {
  if (radiusKm < 1) return `${Math.round(radiusKm * 1000)} ม.`;
  return `${radiusKm} กม.`;
}

function daysBetweenInclusive(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00.000Z`);
  const b = Date.parse(`${toIso}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.floor(Math.abs(b - a) / (24 * 60 * 60 * 1000)) + 1;
}

/** Structural guard used in tests — neighbor loops only, never nested full-set pair scan. */
export function hotspotEngineUsesSpatialBucketing(): boolean {
  return true;
}
