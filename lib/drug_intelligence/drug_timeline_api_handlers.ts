/**
 * Timeline & Geographic Intelligence API handlers (Phase DI-7).
 *
 * Same framework-agnostic handler pattern as
 * drug_intelligence_alert_api_handlers.ts — reuses `assertDrugIntelligencePermission`.
 * Every route here is read-only (drug.read); DI-7 never writes anything —
 * it is purely a consumer of existing case/person/entity/alert data
 * (Section 12: "Timeline is a consumer of DI-6 intelligence, not another
 * alert-generation engine").
 */

import { z } from "zod";
import { badRequest, jsonOk, notFound, internalError } from "@/lib/api/api_response";
import { assertDrugIntelligencePermission } from "@/lib/drug_intelligence/drug_case_api_handlers";
import type { DrugTimelineService } from "@/lib/drug_intelligence/drug_timeline_service";
import { DrugTimelineFocusNotFoundError } from "@/lib/drug_intelligence/drug_timeline_types";
import type { DrugTimelineEvent, DrugTimelineQuery, DrugTimelineGroupMode } from "@/lib/drug_intelligence/drug_timeline_types";
import { groupDrugTimelineEvents } from "@/lib/drug_intelligence/drug_timeline_grouping";
import { drugTimelineListQuerySchema, drugGeographicAggregateQuerySchema, drugTimelineCorrelationsQuerySchema } from "@/lib/drug_intelligence/drug_timeline_api_schemas";

const NO_DATE_LABEL = "ไม่ระบุวันที่";
const NO_PROVINCE_LABEL = "ไม่ระบุจังหวัด";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function serializeEvent(event: DrugTimelineEvent) {
  return {
    ...event,
    arrestDate: event.arrestDate ? event.arrestDate.toISOString() : null,
  };
}

function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toTimelineQuery(data: z.infer<typeof drugTimelineListQuerySchema>): DrugTimelineQuery {
  return {
    dateFrom: parseDateParam(data.dateFrom),
    dateTo: parseDateParam(data.dateTo),
    province: data.province,
    district: data.district,
    reportingUnitText: data.reportingUnitText,
    headquartersId: data.headquartersId,
    regionId: data.regionId,
    battalionId: data.battalionId,
    companyId: data.companyId,
    caseId: data.caseId,
    personId: data.personId,
    phoneNumberId: data.phoneNumberId,
    simId: data.simId,
    deviceId: data.deviceId,
    vehicleId: data.vehicleId,
    drugCategory: data.drugCategory,
    sort: data.sort,
    page: data.page,
    pageSize: data.pageSize,
  };
}

/** GET /api/drug-intelligence/timeline — the main filtered/grouped/paginated feed (Section 4, 5). */
export async function handleDrugTimelineList(service: DrugTimelineService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugTimelineListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid timeline query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  try {
    const result = await service.getTimeline(toTimelineQuery(parsed.data));
    // groupMode besides the service's own default DAY grouping — regroup
    // the already-fetched page here rather than adding a query param the
    // service's own pagination would need to special-case (Section 11: layout
    // switching never re-queries — same principle, applied to grouping).
    const flatEvents = result.groups.flatMap((g) => g.events);
    const groups = parsed.data.groupMode === "DAY" ? result.groups : groupDrugTimelineEvents(flatEvents, parsed.data.groupMode as DrugTimelineGroupMode, NO_DATE_LABEL, NO_PROVINCE_LABEL);

    return jsonOk({
      groups: groups.map((g) => ({ ...g, events: g.events.map(serializeEvent) })),
      totalCount: result.totalCount,
      kpi: {
        ...result.kpi,
        dateRangeFrom: result.kpi.dateRangeFrom ? result.kpi.dateRangeFrom.toISOString() : null,
        dateRangeTo: result.kpi.dateRangeTo ? result.kpi.dateRangeTo.toISOString() : null,
      },
    });
  } catch (error) {
    if (error instanceof DrugTimelineFocusNotFoundError) return notFound("Timeline focus entity not found");
    return internalError("Failed to load timeline");
  }
}

/** GET /api/drug-intelligence/timeline/geographic — Section 9's จังหวัด/อำเภอ -> จำนวนคดี aggregate. */
export async function handleDrugTimelineGeographic(service: DrugTimelineService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugGeographicAggregateQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid geographic query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  try {
    const rows = await service.getGeographicAggregate(toTimelineQuery({ ...parsed.data, sort: "NEWEST_FIRST", groupMode: "DAY", page: 1, pageSize: 500 }));
    return jsonOk({ rows });
  } catch (error) {
    if (error instanceof DrugTimelineFocusNotFoundError) return notFound("Timeline focus entity not found");
    return internalError("Failed to load geographic aggregate");
  }
}

/** GET /api/drug-intelligence/timeline/correlations — Section 10's deterministic correlation signals. */
export async function handleDrugTimelineCorrelations(service: DrugTimelineService, searchParams: URLSearchParams, request: Request): Promise<Response> {
  const parsed = drugTimelineCorrelationsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return badRequest("Invalid correlations query", zodDetails(parsed.error));

  const denied = await assertDrugIntelligencePermission(request, parsed.data.actorId, "drug.read");
  if (denied) return denied;

  try {
    const correlations = await service.getCorrelations(toTimelineQuery({ ...parsed.data, sort: "NEWEST_FIRST", groupMode: "DAY", page: 1, pageSize: 500 }), parsed.data.timeWindowDays);
    return jsonOk({ correlations });
  } catch (error) {
    if (error instanceof DrugTimelineFocusNotFoundError) return notFound("Timeline focus entity not found");
    return internalError("Failed to load correlations");
  }
}
