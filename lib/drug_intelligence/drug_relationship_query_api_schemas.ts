/**
 * Zod schemas for Relationship Search API (Phase 1B).
 */

import { z } from "zod";
import { DRUG_CONTROLLED_RELATIONS } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import { DRUG_REL_QUERY_DEFAULT_PAGE_SIZE, DRUG_REL_QUERY_HARD_PAGE_SIZE } from "@/lib/drug_intelligence/drug_relationship_query_types";

const entityTypeSchema = z.enum(["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE", "LOCATION"]);
const relationIdSchema = z.enum(DRUG_CONTROLLED_RELATIONS.map((r) => r.id) as [string, ...string[]]);

export const drugRelationshipQuerySchema = z.object({
  actorId: z.string().min(1),
  actorName: z.string().min(1).optional(),
  sourceType: entityTypeSchema,
  sourceId: z.string().min(1),
  relationId: relationIdSchema,
  targetType: entityTypeSchema,
  targetId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(DRUG_REL_QUERY_HARD_PAGE_SIZE).default(DRUG_REL_QUERY_DEFAULT_PAGE_SIZE),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type DrugRelationshipQuerySchemaInput = z.infer<typeof drugRelationshipQuerySchema>;
