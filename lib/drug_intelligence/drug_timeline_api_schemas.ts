/**
 * Zod schemas for the DI-7 Timeline & Geographic Intelligence API surface.
 * Mirrors drug_intelligence_alert_api_schemas.ts's conventions exactly.
 */

import { z } from "zod";

const MAX_FIELD = 500;

export const drugTimelineSortDirectionSchema = z.enum(["OLDEST_FIRST", "NEWEST_FIRST"]);
export const drugTimelineGroupModeSchema = z.enum(["DAY", "MONTH", "PERSON", "LOCATION", "CASE"]);

/** GET /api/drug-intelligence/timeline — the main filtered/grouped/paginated feed (Section 4, 5). */
export const drugTimelineListQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  province: z.string().trim().max(MAX_FIELD).optional(),
  district: z.string().trim().max(MAX_FIELD).optional(),
  reportingUnitText: z.string().trim().max(MAX_FIELD).optional(),
  headquartersId: z.coerce.number().int().optional(),
  regionId: z.coerce.number().int().optional(),
  battalionId: z.coerce.number().int().optional(),
  companyId: z.coerce.number().int().optional(),
  caseId: z.string().trim().max(MAX_FIELD).optional(),
  personId: z.string().trim().max(MAX_FIELD).optional(),
  phoneNumberId: z.string().trim().max(MAX_FIELD).optional(),
  simId: z.string().trim().max(MAX_FIELD).optional(),
  deviceId: z.string().trim().max(MAX_FIELD).optional(),
  vehicleId: z.string().trim().max(MAX_FIELD).optional(),
  drugCategory: z.string().trim().max(MAX_FIELD).optional(),
  sort: drugTimelineSortDirectionSchema.default("NEWEST_FIRST"),
  groupMode: drugTimelineGroupModeSchema.default("DAY"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** GET /api/drug-intelligence/timeline/geographic — Section 9's จังหวัด/อำเภอ -> จำนวนคดี aggregate, same filter surface minus sort/group/page. */
export const drugGeographicAggregateQuerySchema = drugTimelineListQuerySchema.omit({ sort: true, groupMode: true, page: true, pageSize: true });

/** GET /api/drug-intelligence/timeline/correlations — Section 10's deterministic correlation signals. */
export const drugTimelineCorrelationsQuerySchema = drugGeographicAggregateQuerySchema.extend({
  timeWindowDays: z.coerce.number().int().min(1).max(365).default(14),
});
