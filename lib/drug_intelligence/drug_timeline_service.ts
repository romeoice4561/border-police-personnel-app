/**
 * DrugTimelineService (Phase DI-7).
 *
 * Builds the Timeline & Geographic Intelligence workspace's data by
 * composing EXISTING services — never a parallel case/location query engine
 * (Section 1 audit finding: DrugCase already carries province/district/
 * subdistrict/latitude/longitude/arrestDate as columns; DrugCaseService.
 * listCases already supports date-range+province filtering).
 *
 * `getTimeline` uses `caseService.listCases()` for the filtered/paginated
 * case-id backbone (mirrors the Alert Center's own "one query decides the
 * scope, everything else is derived from it" convention), then hydrates
 * each case the SAME way DrugCaseService.getCase() already does — bounded
 * N+1 at case-workspace scale, the same acceptable tradeoff `listCases`
 * itself already makes for personCount/seizedItemsSummary (documented in
 * its own docstring).
 *
 * Person/entity-focused views reuse DrugPersonProfileService.getProfile()
 * and DrugEntityDetailService.get*Detail() directly — their `cases`/
 * `sourceCases` arrays are re-projected into DrugTimelineEvent shape, never
 * re-queried from scratch.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugPersonProfileService } from "@/lib/drug_intelligence/drug_person_profile_service";
import { DrugEntityDetailService } from "@/lib/drug_intelligence/drug_entity_detail_service";
import { DrugIntelligenceAlertRepository } from "@/lib/database/repositories/drug_intelligence_alert_repository";
import { sortDrugTimelineEvents, groupDrugTimelineEvents } from "@/lib/drug_intelligence/drug_timeline_grouping";
import { computeDrugTimelineKpi, computeDrugGeographicAggregate, computeDrugTimelineCorrelations } from "@/lib/drug_intelligence/drug_timeline_correlation";
import { DrugTimelineFocusNotFoundError } from "@/lib/drug_intelligence/drug_timeline_types";
import type {
  DrugTimelineEvent,
  DrugTimelineQuery,
  DrugTimelineGroup,
  DrugTimelineGroupMode,
  DrugTimelineListResult,
  DrugGeographicAggregateRow,
  DrugTimelineCorrelation,
} from "@/lib/drug_intelligence/drug_timeline_types";

const NO_DATE_LABEL_FALLBACK = "ไม่ระบุวันที่";
const NO_PROVINCE_LABEL_FALLBACK = "ไม่ระบุจังหวัด";

export class DrugTimelineService {
  private readonly caseService: DrugCaseService;
  private readonly personProfileService: DrugPersonProfileService;
  private readonly entityDetailService: DrugEntityDetailService;
  private readonly alertRepo: DrugIntelligenceAlertRepository;

  constructor(private readonly db: DatabaseClient) {
    this.caseService = new DrugCaseService({ db });
    this.personProfileService = new DrugPersonProfileService(db);
    this.entityDetailService = new DrugEntityDetailService(db);
    this.alertRepo = new DrugIntelligenceAlertRepository(db);
  }

  /**
   * Full filtered/grouped timeline. When `query` names a focus entity
   * (personId/phoneNumberId/simId/deviceId/vehicleId), the case-id
   * candidate set is narrowed via that entity's own service FIRST (Section
   * 6/7 — person/entity history), then the same date/province/reportingUnit
   * filters still apply on top.
   */
  async getTimeline(query: DrugTimelineQuery): Promise<DrugTimelineListResult> {
    let caseIds: string[] | null = null;

    if (query.personId) {
      const profile = await this.personProfileService.getProfile(query.personId).catch(() => null);
      if (!profile) throw new DrugTimelineFocusNotFoundError("PERSON", query.personId);
      caseIds = [...new Set(profile.cases.map((c) => c.caseId))];
    } else if (query.phoneNumberId) {
      const detail = await this.entityDetailService.getPhoneDetail(query.phoneNumberId).catch(() => null);
      if (!detail) throw new DrugTimelineFocusNotFoundError("PHONE", query.phoneNumberId);
      caseIds = detail.sourceCases.map((c) => c.id);
    } else if (query.simId) {
      const detail = await this.entityDetailService.getSimDetail(query.simId).catch(() => null);
      if (!detail) throw new DrugTimelineFocusNotFoundError("SIM", query.simId);
      caseIds = detail.sourceCases.map((c) => c.id);
    } else if (query.deviceId) {
      const detail = await this.entityDetailService.getDeviceDetail(query.deviceId).catch(() => null);
      if (!detail) throw new DrugTimelineFocusNotFoundError("DEVICE", query.deviceId);
      caseIds = detail.sourceCases.map((c) => c.id);
    } else if (query.vehicleId) {
      const detail = await this.entityDetailService.getVehicleDetail(query.vehicleId).catch(() => null);
      if (!detail) throw new DrugTimelineFocusNotFoundError("VEHICLE", query.vehicleId);
      caseIds = detail.sourceCases.map((c) => c.id);
    } else if (query.caseId) {
      caseIds = [query.caseId];
    }

    // listCases already handles date-range + province + reporting-unit + org
    // filtering server-side (Section 1 finding) — call it for EVERY event
    // this query could plausibly include, then narrow to caseIds if a focus
    // entity was given. maxCaseCount keeps this bounded even without a
    // focus filter (Section 23: never an unbounded scan).
    const { rows: caseRows } = await this.caseService.listCases({
      page: 1,
      pageSize: 500,
      province: query.province,
      headquartersId: query.headquartersId,
      regionId: query.regionId,
      battalionId: query.battalionId,
      companyId: query.companyId,
      arrestDateFrom: query.dateFrom,
      arrestDateTo: query.dateTo,
    });

    const scopedRows = caseIds ? caseRows.filter((r) => caseIds!.includes(r.id)) : caseRows;
    const filteredByDistrict = query.district ? scopedRows.filter((r) => r.district === query.district) : scopedRows;
    const filteredByUnit = query.reportingUnitText ? filteredByDistrict.filter((r) => r.reportingUnitText === query.reportingUnitText) : filteredByDistrict;

    const events = await Promise.all(filteredByUnit.map((row) => this.hydrateEvent(row.id)));
    const validEvents = events.filter((e): e is DrugTimelineEvent => e !== null);

    const sorted = sortDrugTimelineEvents(validEvents, query.sort);
    const totalCount = sorted.length;
    const start = (query.page - 1) * query.pageSize;
    const paged = sorted.slice(start, start + query.pageSize);

    const groups = groupDrugTimelineEvents(paged, "DAY", NO_DATE_LABEL_FALLBACK, NO_PROVINCE_LABEL_FALLBACK);
    const kpi = computeDrugTimelineKpi(sorted);

    return { groups, totalCount, kpi };
  }

  /** Section 5: re-groups an already-fetched page under a different mode without a new query — the caller passes the SAME event set back in (client keeps it, or calls getTimeline once and regroups client-side via this same pure helper — exposed here too for a server-only regroup path). */
  regroup(events: DrugTimelineEvent[], mode: DrugTimelineGroupMode): DrugTimelineGroup[] {
    return groupDrugTimelineEvents(events, mode, NO_DATE_LABEL_FALLBACK, NO_PROVINCE_LABEL_FALLBACK);
  }

  /** Section 9: จังหวัด/อำเภอ -> จำนวนคดี, built only from administrative levels present in the data. */
  async getGeographicAggregate(query: DrugTimelineQuery): Promise<DrugGeographicAggregateRow[]> {
    const { groups } = await this.getTimeline({ ...query, page: 1, pageSize: 500 });
    const allEvents = groups.flatMap((g) => g.events);
    return computeDrugGeographicAggregate(allEvents);
  }

  /** Section 10: deterministic correlation signals over the current query scope — never a probabilistic score. */
  async getCorrelations(query: DrugTimelineQuery, timeWindowDays: number): Promise<DrugTimelineCorrelation[]> {
    const { groups } = await this.getTimeline({ ...query, page: 1, pageSize: 500 });
    const allEvents = groups.flatMap((g) => g.events);
    return computeDrugTimelineCorrelations(allEvents, timeWindowDays);
  }

  /** Hydrates one DrugTimelineEvent from a caseId — mirrors DrugCaseService.getCase()'s own hydration exactly, projected into the timeline shape. Returns null only if the case vanished between listCases and hydration (never expected in practice; defensive only). */
  private async hydrateEvent(caseId: string): Promise<DrugTimelineEvent | null> {
    const detail = await this.caseService.getCase(caseId).catch(() => null);
    if (!detail) return null;
    const c = detail.case;

    const latitude = c.latitude !== null && c.latitude !== undefined ? Number(c.latitude) : null;
    const longitude = c.longitude !== null && c.longitude !== undefined ? Number(c.longitude) : null;

    const alerts = await this.alertRepo.findForCase(caseId);
    const hasUnreviewedAlert = alerts.some((a) => a.status === "NEW");

    const seizedSummary = summarizeSeizedItemsForTimeline(
      detail.seizedItems as Array<{ drugType: string; measurementKind: string; quantity: unknown; unit: string | null; weightGrams: unknown }>
    );

    return {
      caseId: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      status: c.status,
      arrestDate: c.arrestDate,
      province: c.province,
      district: c.district,
      subdistrict: c.subdistrict,
      locationName: c.locationName,
      latitude,
      longitude,
      hasCoordinates: latitude !== null && longitude !== null,
      reportingUnitText: c.reportingUnitText,
      personCount: detail.personCount,
      persons: detail.persons.map((p) => ({ personId: p.personId, primaryFullName: p.person?.primaryFullName ?? "—", role: p.role })),
      phoneCount: detail.phoneCount,
      simCount: detail.simCount,
      deviceCount: detail.deviceCount,
      vehicleCount: detail.vehicleCount,
      seizedItemCount: detail.seizedItemCount,
      seizedItemsSummary: seizedSummary,
      hasUnreviewedAlert,
    };
  }
}

/** Mirrors DrugCaseService's own module-private summarizeSeizedItems() exactly (not exported there) — same formatting rule, kept in sync deliberately since both read the same DrugSeizedItem shape. */
function summarizeSeizedItemsForTimeline(items: Array<{ drugType: string; measurementKind: string; quantity: unknown; unit: string | null; weightGrams: unknown }>): string {
  if (items.length === 0) return "";
  const parts: string[] = [];
  for (const item of items) {
    const quantity = item.quantity !== null && item.quantity !== undefined ? Number(item.quantity) : null;
    const weightGrams = item.weightGrams !== null && item.weightGrams !== undefined ? Number(item.weightGrams) : null;
    if (item.measurementKind === "COUNT" && quantity !== null) {
      parts.push(`${item.drugType} ${quantity.toLocaleString("th-TH")}${item.unit ? ` ${item.unit}` : ""}`);
    } else if (item.measurementKind === "MASS" && weightGrams !== null) {
      const kg = weightGrams / 1000;
      parts.push(`${item.drugType} ${kg.toLocaleString("th-TH", { maximumFractionDigits: 2 })} กก.`);
    } else {
      parts.push(item.drugType);
    }
  }
  return parts.join(" • ");
}
