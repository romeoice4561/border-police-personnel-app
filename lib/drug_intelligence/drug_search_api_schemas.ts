/**
 * Zod schemas for the DI-3 Global Intelligence Search API surface. Mirrors
 * drug_person_api_schemas.ts's conventions exactly (trimmed strings,
 * MAX_FIELD cap, `.coerce.number()` for query-string numerics).
 */

import { z } from "zod";

const MAX_FIELD = 500;

export const drugSearchEntityTypeSchema = z.enum(["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE"]);

/**
 * Section 3/23: Global Search's grouped-overview call. GET query params —
 * everything comes in as strings; filters are flattened directly onto this
 * schema (rather than nested JSON) since URL query params don't nest well.
 * `actorName` is required (unlike DI-2's other GET/view endpoints) because
 * this call writes a `search_performed` DrugAuditLog row — the same
 * "client always supplies actorName for anything that audits" convention
 * every DI-2 WRITE endpoint already follows.
 */
export const drugSearchGroupedQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
  q: z.string().trim().max(MAX_FIELD).default(""),
  entityType: drugSearchEntityTypeSchema.optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  province: z.string().trim().max(MAX_FIELD).optional(),
  headquartersId: z.coerce.number().int().optional(),
  regionId: z.coerce.number().int().optional(),
  battalionId: z.coerce.number().int().optional(),
  companyId: z.coerce.number().int().optional(),
  minCaseCount: z.coerce.number().int().min(1).optional(),
  perGroupLimit: z.coerce.number().int().min(1).max(50).optional(),
});

/** Section 24: single-entity-type paginated drill-in ("ดูทั้งหมด"). */
export const drugSearchByTypeQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  q: z.string().trim().max(MAX_FIELD).default(""),
  entityType: drugSearchEntityTypeSchema,
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  province: z.string().trim().max(MAX_FIELD).optional(),
  headquartersId: z.coerce.number().int().optional(),
  regionId: z.coerce.number().int().optional(),
  battalionId: z.coerce.number().int().optional(),
  companyId: z.coerce.number().int().optional(),
  minCaseCount: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
