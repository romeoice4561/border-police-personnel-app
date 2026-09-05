/**
 * Zod schemas for DI-9.5B Saved Investigation Board APIs.
 *
 * Server is the authority: payload size, graph bounds, and image-source
 * rejection are enforced here. Unknown JSON keys are rejected (.strict()).
 */

import { z } from "zod";
import {
  DRUG_GRAPH_HARD_MAX_NODES,
  DRUG_GRAPH_MAX_DEPTH,
} from "@/lib/drug_intelligence/drug_network_graph_types";
import { drugGraphNodeTypeSchema, drugGraphRelationshipTypeSchema } from "@/lib/drug_intelligence/drug_network_graph_api_schemas";
import {
  DRUG_INVESTIGATION_BOARD_SCHEMA_VERSION,
  DRUG_INVESTIGATION_BOARD_STATE_MAX_BYTES,
} from "@/lib/drug_intelligence/drug_investigation_board_state";

const MAX_FIELD = 500;
const MAX_TEXT = 2000;

const actorFields = {
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
};

const finiteNumber = z.number().finite();

const isoDateLike = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), "must be an ISO date/datetime");

export const drugInvestigationBoardStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

const graphContextSchema = z
  .object({
    focusType: drugGraphNodeTypeSchema,
    focusId: z.string().trim().min(1).max(MAX_FIELD),
    depth: z.number().int().min(1).max(DRUG_GRAPH_MAX_DEPTH),
    dateFrom: isoDateLike.optional(),
    dateTo: isoDateLike.optional(),
    maxNodes: z.number().int().min(1).max(DRUG_GRAPH_HARD_MAX_NODES).optional(),
    nodeTypes: z.array(drugGraphNodeTypeSchema).max(7).optional(),
    relationshipTypes: z.array(drugGraphRelationshipTypeSchema).max(16).optional(),
    pathViewNodeIds: z.array(z.string().trim().min(1).max(MAX_FIELD)).max(DRUG_GRAPH_HARD_MAX_NODES).optional(),
  })
  .strict();

const viewportSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
    zoom: finiteNumber,
  })
  .strict();

const presentationSchema = z
  .object({
    layoutMode: z.enum(["AUTO", "PERSON_CENTERED", "CASE_CENTERED", "HIERARCHICAL", "GROUP_BY_TYPE", "COMPACT", "PATH"]),
    labelMode: z.enum(["ALL", "SELECTED_ONLY", "HIDDEN"]),
    nodeDensity: z.enum(["STANDARD", "COMPACT"]),
    boardLocked: z.boolean(),
    viewport: viewportSchema,
  })
  .strict();

const nodeLayoutItemSchema = z
  .object({
    entityType: drugGraphNodeTypeSchema,
    entityId: z.string().trim().min(1).max(MAX_FIELD),
    x: finiteNumber,
    y: finiteNumber,
    pinned: z.boolean(),
  })
  .strict();

const waypointSchema = z
  .object({
    id: z.string().trim().min(1).max(MAX_FIELD),
    x: finiteNumber,
    y: finiteNumber,
  })
  .strict();

const edgeRouteSchema = z
  .object({
    edgeId: z.string().trim().min(1).max(MAX_FIELD),
    mode: z.enum(["AUTO", "STRAIGHT", "ORTHOGONAL", "CURVED"]),
    waypoints: z.array(waypointSchema).max(50),
  })
  .strict();

const FORBIDDEN_IMAGE_SRC = /^(blob:|data:|https?:)/i;

const annotationSchema = z
  .object({
    id: z.string().trim().min(1).max(MAX_FIELD).refine((id) => id.startsWith("ann-"), "annotation id must use ann- prefix"),
    type: z.enum(["RECTANGLE", "ELLIPSE", "TEXT", "LINE", "ARROW", "IMAGE"]),
    color: z.string().trim().min(1).max(32),
    fillColor: z.string().trim().min(1).max(32),
    strokeWidth: z.number().finite().min(0).max(32),
    strokeDash: z.enum(["solid", "dashed", "dotted"]).optional(),
    text: z.string().max(MAX_TEXT).optional(),
    fontSize: z.number().finite().min(1).max(96).optional(),
    endOffset: z.object({ x: finiteNumber, y: finiteNumber }).strict().optional(),
    position: z.object({ x: finiteNumber, y: finiteNumber }).strict(),
    width: z.number().finite().positive().max(10000).optional(),
    height: z.number().finite().positive().max(10000).optional(),
    caption: z.string().max(MAX_TEXT).optional(),
    imageId: z.string().trim().min(1).max(MAX_FIELD).optional(),
    imageSrc: z.string().max(MAX_FIELD).optional(),
  })
  .strict()
  .superRefine((ann, ctx) => {
    if (ann.imageSrc !== undefined && ann.imageSrc !== "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageSrc"],
        message: "persisted boards cannot store blob:, data:, or remote image URLs",
      });
    }
    if (ann.type === "IMAGE" && ann.imageSrc && FORBIDDEN_IMAGE_SRC.test(ann.imageSrc)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageSrc"],
        message: "unsupported image source",
      });
    }
  });

export const drugInvestigationBoardStateV1Schema = z
  .object({
    schemaVersion: z.literal(DRUG_INVESTIGATION_BOARD_SCHEMA_VERSION),
    graphContext: graphContextSchema,
    presentation: presentationSchema,
    nodeLayout: z.array(nodeLayoutItemSchema).max(DRUG_GRAPH_HARD_MAX_NODES),
    pinnedNodeIds: z.array(z.string().trim().min(1).max(MAX_FIELD)).max(DRUG_GRAPH_HARD_MAX_NODES),
    edgeRoutes: z.array(edgeRouteSchema).max(500),
    annotations: z.array(annotationSchema).max(200),
  })
  .strict();

export function measureBoardStateBytes(state: unknown): number {
  return Buffer.byteLength(JSON.stringify(state), "utf8");
}

export function assertBoardStatePayloadSize(state: unknown): { ok: true } | { ok: false; bytes: number } {
  const bytes = measureBoardStateBytes(state);
  if (bytes > DRUG_INVESTIGATION_BOARD_STATE_MAX_BYTES) return { ok: false, bytes };
  return { ok: true };
}

export const drugInvestigationBoardCreateSchema = z
  .object({
    ...actorFields,
    title: z.string().trim().min(1).max(MAX_FIELD),
    description: z.string().trim().max(MAX_TEXT).optional().nullable(),
    state: drugInvestigationBoardStateV1Schema,
  })
  .strict();

export const drugInvestigationBoardUpdateSchema = z
  .object({
    ...actorFields,
    expectedVersion: z.number().int().min(1),
    title: z.string().trim().min(1).max(MAX_FIELD).optional(),
    description: z.string().trim().max(MAX_TEXT).optional().nullable(),
    state: drugInvestigationBoardStateV1Schema.optional(),
  })
  .strict()
  .refine((v) => v.title !== undefined || v.description !== undefined || v.state !== undefined, {
    message: "at least one of title, description, or state is required",
  });

export const drugInvestigationBoardListQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  status: drugInvestigationBoardStatusSchema.optional(),
});

export const drugInvestigationBoardGetQuerySchema = z.object({
  actorId: z.string().trim().min(1),
});

export const drugInvestigationBoardIdSchema = z.string().trim().min(1).max(MAX_FIELD);

export const drugInvestigationBoardDuplicateSchema = z
  .object({
    ...actorFields,
    title: z.string().trim().min(1).max(MAX_FIELD).optional(),
  })
  .strict();

export const drugInvestigationBoardArchiveSchema = z
  .object({
    ...actorFields,
  })
  .strict();
