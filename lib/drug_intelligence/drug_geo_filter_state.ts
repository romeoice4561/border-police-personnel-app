/**
 * Drug Geo filter state <-> URL search params (Phase DI-8, Section 29).
 *
 * ONE shape shared by the filter panel and the map page — every filter
 * persists in the URL, so refresh/back/forward restore the exact same
 * view. Text labels (headquartersText etc.) are UI-only convenience for
 * the OrgHierarchyPicker's display — never written to the URL themselves
 * (only their resolved *Id survives a refresh; the picker re-resolves the
 * label from the id via the org tree, same as Create Case's own draft
 * pattern for a page load that already has an id).
 */

export interface DrugGeoFilterState {
  dateFrom: string;
  dateTo: string;
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
}

export function createEmptyDrugGeoFilterState(): DrugGeoFilterState {
  return {
    dateFrom: "",
    dateTo: "",
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
  };
}

/** Org-hierarchy ids — the only fields that round-trip as numbers. Listed explicitly rather than inferred from an "Id" name suffix, since personId/caseId also end in "Id" but are string business keys, not numeric org ids. */
const NUMERIC_KEYS: Array<keyof DrugGeoFilterState> = ["headquartersId", "regionId", "battalionId", "companyId", "leadHeadquartersId", "leadRegionId", "leadBattalionId", "leadCompanyId"];
const STRING_KEYS: Array<keyof DrugGeoFilterState> = ["dateFrom", "dateTo", "province", "district", "status", "drugCategory", "personId", "caseId"];
const URL_KEYS: Array<keyof DrugGeoFilterState> = [...STRING_KEYS, ...NUMERIC_KEYS];

/** Reads filter state from URLSearchParams — numeric org-id fields are parsed; text-label fields are NOT persisted (see module doc comment) and are left blank for the caller to re-resolve. */
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
  return state;
}

/** Serializes filter state to URLSearchParams — omits empty/null values so the URL stays clean (Section 29: "avoid noisy URL if not necessary"). */
export function drugGeoFilterStateToSearchParams(state: DrugGeoFilterState): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of URL_KEYS) {
    const value = state[key];
    if (value === null || value === "" || value === undefined) continue;
    params.set(key, String(value));
  }
  return params;
}

export function isDrugGeoFilterStateEmpty(state: DrugGeoFilterState): boolean {
  return URL_KEYS.every((key) => {
    const value = state[key];
    return value === null || value === "" || value === undefined;
  });
}
