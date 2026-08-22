/**
 * Zod schemas for the DI-6 Intelligence Alert API surface. Mirrors
 * drug_network_graph_api_schemas.ts's conventions exactly.
 */

import { z } from "zod";

const MAX_FIELD = 500;

export const drugAlertTypeSchema = z.enum([
  "REPEAT_PERSON",
  "REPEAT_PHONE",
  "REPEAT_SIM",
  "REPEAT_DEVICE",
  "REPEAT_VEHICLE",
  "REPEAT_CASE_ENTITY",
  "NEW_NETWORK_CONNECTION",
  "HIGH_CONFIDENCE_DUPLICATE",
]);

export const drugAlertSeveritySchema = z.enum(["INFO", "NOTICE", "HIGH"]);
export const drugAlertEntityTypeSchema = z.enum(["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE"]);
export const drugAlertStatusSchema = z.enum(["NEW", "REVIEWED", "DISMISSED"]);

/** GET /api/drug-intelligence/alerts — Alert Center list + KPI (Section 8, 20). */
export const drugAlertListQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  status: drugAlertStatusSchema.optional(),
  alertType: drugAlertTypeSchema.optional(),
  severity: drugAlertSeveritySchema.optional(),
  entityType: drugAlertEntityTypeSchema.optional(),
  currentCaseId: z.string().trim().max(MAX_FIELD).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  query: z.string().trim().max(MAX_FIELD).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** GET /api/drug-intelligence/alerts/entity — repeat-intelligence context for one entity (Section 14/15). */
export const drugAlertForEntityQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  entityType: drugAlertEntityTypeSchema,
  entityId: z.string().trim().min(1).max(MAX_FIELD),
});

/** GET /api/drug-intelligence/alerts/case — alert summary for one case (Section 13). */
export const drugAlertForCaseQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  caseId: z.string().trim().min(1).max(MAX_FIELD),
});

/** GET /api/drug-intelligence/alerts/quick-check — Section 4's debounced real-time inline signal for the Create Case wizard. */
export const drugAlertQuickCheckQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  entityType: z.enum(["PHONE", "DEVICE", "VEHICLE"]),
  rawInput: z.string().trim().max(MAX_FIELD).optional(),
  imei1: z.string().trim().max(MAX_FIELD).optional(),
  serialNumber: z.string().trim().max(MAX_FIELD).optional(),
  registrationNumber: z.string().trim().max(MAX_FIELD).optional(),
  registrationProvince: z.string().trim().max(MAX_FIELD).optional(),
  vin: z.string().trim().max(MAX_FIELD).optional(),
});

/** POST /api/drug-intelligence/alerts/generate — Section 6/7's real-time + post-create generation trigger. */
export const drugAlertGenerateSchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
  caseId: z.string().trim().min(1).max(MAX_FIELD),
});

/** POST /api/drug-intelligence/alerts/[id]/review */
export const drugAlertReviewSchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
});

/** POST /api/drug-intelligence/alerts/[id]/dismiss */
export const drugAlertDismissSchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(1000),
});

/** POST /api/drug-intelligence/alerts/[id]/reopen */
export const drugAlertReopenSchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
});
