/**
 * Zod schemas for the DI-5 Network Intelligence / Link Analysis API surface
 * (Section 6). Mirrors drug_search_api_schemas.ts's conventions exactly.
 */

import { z } from "zod";
import { DRUG_GRAPH_HARD_MAX_NODES, DRUG_GRAPH_PATH_MAX_DEPTH } from "@/lib/drug_intelligence/drug_network_graph_types";

const MAX_FIELD = 500;

export const drugGraphNodeTypeSchema = z.enum(["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE", "LOCATION"]);

export const drugGraphRelationshipTypeSchema = z.enum([
  "PERSON_CASE",
  "PERSON_PHONE",
  "PERSON_SIM",
  "PERSON_DEVICE",
  "PERSON_VEHICLE",
  "CASE_PHONE",
  "CASE_SIM",
  "CASE_DEVICE",
  "CASE_VEHICLE",
  "CASE_LOCATION",
  "SHARED_CASE",
  "SHARED_PHONE",
  "SHARED_SIM",
  "SHARED_DEVICE",
  "SHARED_VEHICLE",
]);

/** GET /api/drug-intelligence/network — bounded neighborhood expansion (Section 4). */
export const drugGraphNeighborhoodQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  entityType: drugGraphNodeTypeSchema,
  entityId: z.string().trim().min(1).max(MAX_FIELD),
  depth: z.coerce.number().int().min(1).max(2).default(1),
  nodeTypes: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : undefined)),
  relationshipTypes: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : undefined)),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  maxNodes: z.coerce.number().int().min(1).max(DRUG_GRAPH_HARD_MAX_NODES).optional(),
});

/** GET /api/drug-intelligence/network/path — bounded path finding (Section 5). */
export const drugGraphPathQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  fromType: drugGraphNodeTypeSchema,
  fromId: z.string().trim().min(1).max(MAX_FIELD),
  toType: drugGraphNodeTypeSchema,
  toId: z.string().trim().min(1).max(MAX_FIELD),
  maxDepth: z.coerce.number().int().min(1).max(DRUG_GRAPH_PATH_MAX_DEPTH).optional(),
});
