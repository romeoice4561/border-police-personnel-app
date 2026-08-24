/**
 * Timeline & Geographic Intelligence — domain types (Phase DI-7).
 *
 * A "timeline event" is always ONE DrugCase (Section 5: "DATE -> CASE ->
 * LOCATION -> PERSONS -> PHONE/SIM/DEVICE/VEHICLE -> SEIZURE SUMMARY") — DI-7
 * never invents a separate "event" concept distinct from a case. This
 * mirrors DI-6's own principle of composing existing services rather than
 * building a parallel data model: the chronological backbone is
 * DrugCaseService.listCases() (already date/province-filterable), and each
 * event is hydrated the same way DrugCaseService.getCase() already hydrates
 * a full case (Section 1 audit finding: no new schema needed for the
 * timeline backbone itself).
 *
 * Framework-agnostic: no React, no Next.js Request/Response, no Prisma
 * import here — mirrors drug_network_graph_types.ts / drug_intelligence_alert_types.ts.
 */

export type DrugTimelineSortDirection = "OLDEST_FIRST" | "NEWEST_FIRST";

export type DrugTimelineGroupMode = "DAY" | "MONTH" | "PERSON" | "LOCATION" | "CASE";

/** Mirrors DrugGraphNodeType's entity vocabulary minus CASE/LOCATION (an event's focus entity, not the event itself). */
export type DrugTimelineFocusEntityType = "PERSON" | "PHONE" | "SIM" | "DEVICE" | "VEHICLE";

/**
 * One timeline event = one DrugCase, hydrated with exactly the fields the
 * spec's vertical event card needs. `hasCoordinates` is always derived
 * (`latitude !== null && longitude !== null`), never assumed — Section 8:
 * "never fabricate coordinates," so a caller can trust this flag instead of
 * checking nullability itself at every call site.
 */
export interface DrugTimelineEvent {
  caseId: string;
  caseNumber: string;
  title: string;
  status: string;
  arrestDate: Date | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  hasCoordinates: boolean;
  reportingUnitText: string | null;
  personCount: number;
  persons: Array<{ personId: string; primaryFullName: string; role: string }>;
  phoneCount: number;
  simCount: number;
  deviceCount: number;
  vehicleCount: number;
  seizedItemCount: number;
  /** Pre-formatted summary string, reusing DrugCaseService's own summarizeSeizedItems() exactly — never a second seizure-formatting implementation. */
  seizedItemsSummary: string;
  /** True when this case has at least one NEW/unreviewed DI-6 alert — Section 12: a small indicator only, never a duplicate alert computation. */
  hasUnreviewedAlert: boolean;
}

export interface DrugTimelineQuery {
  dateFrom?: Date;
  dateTo?: Date;
  province?: string;
  district?: string;
  reportingUnitText?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  caseId?: string;
  personId?: string;
  phoneNumberId?: string;
  simId?: string;
  deviceId?: string;
  vehicleId?: string;
  drugCategory?: string;
  sort: DrugTimelineSortDirection;
  page: number;
  pageSize: number;
}

export interface DrugTimelineGroup {
  groupKey: string;
  /** Human-readable group label already resolved server-side (e.g. a formatted month, a person's name, a province) — the client never re-derives grouping labels itself. */
  groupLabel: string;
  events: DrugTimelineEvent[];
}

export interface DrugTimelineKpi {
  eventCount: number;
  provinceCount: number;
  /** Section 3: "บุคคลที่พบซ้ำหลายพื้นที่" — a person whose recorded cases span 2+ distinct provinces. */
  personsRepeatedAcrossAreas: number;
  /** Section 3: "อุปกรณ์/หมายเลขที่พบซ้ำหลายพื้นที่" — a phone/SIM/device/vehicle whose recorded cases span 2+ distinct provinces. */
  entitiesRepeatedAcrossAreas: number;
  /** Section 3: "พื้นที่ที่มีเหตุซ้ำ" — a province with 2+ recorded cases within the current query scope. */
  areasWithRepeatEvents: number;
  dateRangeFrom: Date | null;
  dateRangeTo: Date | null;
}

export interface DrugTimelineListResult {
  groups: DrugTimelineGroup[];
  totalCount: number;
  kpi: DrugTimelineKpi;
}

/** Section 9: "จังหวัด -> จำนวนคดี" / "อำเภอ -> จำนวนคดี" — only ever built from administrative levels actually present in the data (never a fabricated hierarchy). */
export interface DrugGeographicAggregateRow {
  province: string;
  district: string | null;
  caseCount: number;
  eventIds: string[];
}

/**
 * Section 10 correlation signals — deterministic, never probabilistic. Each
 * row states a FACT recorded in the data ("this entity appears in N
 * provinces / M cases"), never a risk score. Wording is composed
 * server-side using the SAME neutral vocabulary DI-6 already established
 * ("ควรตรวจสอบเพิ่มเติม") — see drug_timeline_explanation.ts.
 */
export type DrugTimelineCorrelationKind =
  | "ENTITY_MULTI_AREA" // same phone/device/vehicle/person appears across 2+ provinces
  | "SHARED_LOCATION_MULTI_PERSON" // 2+ distinct persons recorded at the same province/case
  | "TIME_WINDOW_CLUSTER"; // 2+ cases within a configurable day window, same province

export interface DrugTimelineCorrelation {
  kind: DrugTimelineCorrelationKind;
  entityType: DrugTimelineFocusEntityType | "CASE" | null;
  entityId: string | null;
  province: string | null;
  caseIds: string[];
  explanation: string;
}

export class DrugTimelineFocusNotFoundError extends Error {
  constructor(entityType: DrugTimelineFocusEntityType, entityId: string) {
    super(`Timeline focus ${entityType} '${entityId}' not found`);
    this.name = "DrugTimelineFocusNotFoundError";
  }
}
