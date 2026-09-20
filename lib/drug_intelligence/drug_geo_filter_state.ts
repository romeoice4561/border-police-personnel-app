/**
 * Drug Geo filter state <-> URL search params (Phase DI-8 / DI-8.2.1).
 *
 * ONE shape shared by the filter panel and the map page — every filter
 * persists in the URL, so refresh/back/forward restore the exact same
 * view. Text labels (headquartersText etc.) are UI-only convenience for
 * the OrgHierarchyPicker's display — never written to the URL themselves.
 *
 * Temporal (DI-8.2.1):
 * - weekdays: ISO Mon=1…Sun=7 CSV, e.g. "5,6"
 * - timePreset: ALL_DAY | H00_03…H21_24 | CUSTOM
 * - timeFrom / timeTo: HH:MM (CUSTOM only; overnight allowed)
 */

import {
  parseWeekdaysParam,
  serializeWeekdaysParam,
  MAP_TIME_PRESET_VALUES,
  type IsoWeekday,
  type MapTimePreset,
} from "@/lib/drug_intelligence/drug_map_temporal";
import {
  DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM,
  parseDrugGeoMapModeParam,
  parseHotspotRadiusKmParam,
  type DrugGeoHotspotRadiusKm,
  type DrugGeoMapMode,
} from "@/lib/drug_intelligence/drug_geo_hotspot";

export interface DrugGeoFilterState {
  dateFrom: string;
  dateTo: string;
  /** ISO weekdays Mon=1…Sun=7. Empty = ทุกวัน (no restriction). */
  weekdays: IsoWeekday[];
  /** Default ALL_DAY — no time filter. */
  timePreset: MapTimePreset;
  /** CUSTOM range start HH:MM. */
  timeFrom: string;
  /** CUSTOM range end HH:MM (overnight allowed when timeFrom > timeTo). */
  timeTo: string;
  province: string;
  district: string;
  status: string;
  drugCategory: string;
  headquartersId: number | null;
  headquartersText: string;
  regionId: number | null;
  regionText: string;
  battalionId: number | null;
  battalionText: string;
  companyId: number | null;
  companyText: string;
  leadHeadquartersId: number | null;
  leadHeadquartersText: string;
  leadRegionId: number | null;
  leadRegionText: string;
  leadBattalionId: number | null;
  leadBattalionText: string;
  leadCompanyId: number | null;
  leadCompanyText: string;
  personId: string;
  caseId: string;
  /** DI-8.2B — POINTS | HOTSPOT | DENSITY. Default POINTS omitted from URL. */
  geoMode: DrugGeoMapMode;
  /** DI-8.2B — hotspot radius km. Default 3 omitted from URL. */
  hotspotRadiusKm: DrugGeoHotspotRadiusKm;
}

export function createEmptyDrugGeoFilterState(): DrugGeoFilterState {
  return {
    dateFrom: "",
    dateTo: "",
    weekdays: [],
    timePreset: "ALL_DAY",
    timeFrom: "",
    timeTo: "",
    province: "",
    district: "",
    status: "",
    drugCategory: "",
    headquartersId: null,
    headquartersText: "",
    regionId: null,
    regionText: "",
    battalionId: null,
    battalionText: "",
    companyId: null,
    companyText: "",
    leadHeadquartersId: null,
    leadHeadquartersText: "",
    leadRegionId: null,
    leadRegionText: "",
    leadBattalionId: null,
    leadBattalionText: "",
    leadCompanyId: null,
    leadCompanyText: "",
    personId: "",
    caseId: "",
    geoMode: "POINTS",
    hotspotRadiusKm: DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM,
  };
}

const NUMERIC_KEYS: Array<keyof DrugGeoFilterState> = [
  "headquartersId",
  "regionId",
  "battalionId",
  "companyId",
  "leadHeadquartersId",
  "leadRegionId",
  "leadBattalionId",
  "leadCompanyId",
];
const STRING_KEYS: Array<keyof DrugGeoFilterState> = [
  "dateFrom",
  "dateTo",
  "timeFrom",
  "timeTo",
  "province",
  "district",
  "status",
  "drugCategory",
  "personId",
  "caseId",
];

const TIME_PRESETS: readonly MapTimePreset[] = MAP_TIME_PRESET_VALUES;

function isMapTimePreset(value: string): value is MapTimePreset {
  return (TIME_PRESETS as readonly string[]).includes(value);
}

/** Reads filter state from URLSearchParams. */
export function drugGeoFilterStateFromSearchParams(params: URLSearchParams): DrugGeoFilterState {
  const state = createEmptyDrugGeoFilterState();
  for (const key of STRING_KEYS) {
    const raw = params.get(key);
    if (raw === null || raw === "") continue;
    (state as unknown as Record<string, string>)[key] = raw;
  }
  for (const key of NUMERIC_KEYS) {
    const raw = params.get(key);
    if (raw === null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) (state as unknown as Record<string, number>)[key] = n;
  }
  state.weekdays = parseWeekdaysParam(params.get("weekdays"));
  const timePreset = params.get("timePreset");
  if (timePreset && isMapTimePreset(timePreset)) state.timePreset = timePreset;
  state.geoMode = parseDrugGeoMapModeParam(params.get("geoMode"));
  state.hotspotRadiusKm = parseHotspotRadiusKmParam(params.get("hotspotRadiusKm"));
  return state;
}

/** Serializes filter state to URLSearchParams — omits empty/default temporal values. */
export function drugGeoFilterStateToSearchParams(state: DrugGeoFilterState): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of STRING_KEYS) {
    const value = state[key];
    if (value === null || value === "" || value === undefined) continue;
    // timeFrom/timeTo only meaningful for CUSTOM
    if ((key === "timeFrom" || key === "timeTo") && state.timePreset !== "CUSTOM") continue;
    params.set(key, String(value));
  }
  for (const key of NUMERIC_KEYS) {
    const value = state[key];
    if (value === null || value === "" || value === undefined) continue;
    params.set(key, String(value));
  }
  const weekdays = serializeWeekdaysParam(state.weekdays);
  if (weekdays) params.set("weekdays", weekdays);
  if (state.timePreset && state.timePreset !== "ALL_DAY") params.set("timePreset", state.timePreset);
  if (state.geoMode && state.geoMode !== "POINTS") params.set("geoMode", state.geoMode);
  if (state.hotspotRadiusKm !== DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM) {
    params.set("hotspotRadiusKm", String(state.hotspotRadiusKm));
  }
  return params;
}

export function isDrugGeoFilterStateEmpty(state: DrugGeoFilterState): boolean {
  if (state.weekdays.length > 0) return false;
  if (state.timePreset !== "ALL_DAY") return false;
  if (state.timeFrom || state.timeTo) return false;
  if (state.geoMode !== "POINTS") return false;
  if (state.hotspotRadiusKm !== DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM) return false;
  const keys: Array<keyof DrugGeoFilterState> = [...STRING_KEYS, ...NUMERIC_KEYS];
  return keys.every((key) => {
    const value = state[key];
    return value === null || value === "" || value === undefined;
  });
}
