/**
 * Drug Export Context V1 — client input + server-resolved context.
 * actorId and generatedAt are SERVER-DERIVED and never taken from the client.
 */

import { z } from "zod";
import { DRUG_CASE_STATUSES } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_CATEGORIES } from "@/lib/drug_intelligence/drug_seized_item_options";

const GRAPH_NODE_TYPES = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE", "LOCATION"] as const;
import {
  DRUG_EXPORT_NETWORK_HARD_MAX_NODES,
  DRUG_EXPORT_NETWORK_MAX_DEPTH,
} from "@/lib/drug_intelligence/drug_export_limits";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ROUTE = /^\/drug-intelligence(?:\/[A-Za-z0-9._~-]*)*$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return date.getUTCFullYear() === y && date.getUTCMonth() === (m ?? 1) - 1 && date.getUTCDate() === d;
}

const isoDate = z
  .string()
  .trim()
  .refine(isValidIsoDate, "date must be YYYY-MM-DD");

const optionalIsoDate = isoDate.optional();

export const drugExportContextV1InputSchema = z
  .object({
    schemaVersion: z.literal(1),
    locale: z.enum(["th", "en"]),
    sourceRoute: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((v) => SAFE_ROUTE.test(v) && !v.includes(".."), "sourceRoute must be a /drug-intelligence path"),
    period: z
      .object({
        fiscalYearBe: z.number().int().min(2500).max(2700).optional(),
        dateFrom: optionalIsoDate,
        dateTo: optionalIsoDate,
      })
      .optional(),
    organization: z
      .object({
        hqId: z.number().int().positive().optional(),
        regionId: z.number().int().positive().optional(),
        battalionId: z.number().int().positive().optional(),
        companyId: z.number().int().positive().optional(),
      })
      .optional(),
    geo: z
      .object({
        province: z.string().trim().max(80).optional(),
        district: z.string().trim().max(80).optional(),
        status: z.enum(DRUG_CASE_STATUSES).optional(),
        drugCategory: z.enum(DRUG_CATEGORIES).optional(),
      })
      .optional(),
    completeness: z.enum(["missingArrested", "missingReportingUnit", "missingCoordinates", "incompleteSeizure"]).optional(),
    alert: z
      .object({
        status: z.string().trim().max(40).optional(),
      })
      .optional(),
    relationshipSearch: z
      .object({
        sourceType: z.enum(GRAPH_NODE_TYPES).optional(),
        sourceId: z.string().trim().max(80).optional(),
        targetType: z.enum(GRAPH_NODE_TYPES).optional(),
        targetId: z.string().trim().max(80).optional(),
      })
      .optional(),
    network: z
      .object({
        focusType: z.enum(GRAPH_NODE_TYPES).optional(),
        focusId: z.string().trim().max(80).optional(),
        depth: z.number().int().min(1).max(DRUG_EXPORT_NETWORK_MAX_DEPTH).optional(),
        maxNodes: z.number().int().min(1).max(DRUG_EXPORT_NETWORK_HARD_MAX_NODES).optional(),
        pathView: z.boolean().optional(),
      })
      .optional(),
    board: z
      .object({
        boardId: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .refine((v) => !/[\\/]/.test(v), "boardId must not contain a path"),
      })
      .optional(),
    map: z
      .object({
        bounds: z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]).optional(),
        layers: z.array(z.string().trim().max(40).regex(/^[A-Za-z0-9_-]+$/)).max(20).optional(),
        viewMode: z.enum(["MAP", "LIST", "PROVINCE"]).optional(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    const from = value.period?.dateFrom;
    const to = value.period?.dateTo;
    if ((from && !to) || (!from && to)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["period"], message: "dateFrom and dateTo must both be set" });
    }
    if (from && to && from > to) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["period", "dateTo"], message: "dateFrom must not be after dateTo" });
    }
  });

export type DrugExportContextV1Input = z.infer<typeof drugExportContextV1InputSchema>;

export interface ResolvedDrugExportContextV1 extends DrugExportContextV1Input {
  actorId: string;
  generatedAt: string;
}

export function resolveDrugExportContext(
  input: DrugExportContextV1Input,
  actorId: string,
  generatedAt = new Date()
): ResolvedDrugExportContextV1 {
  return {
    ...input,
    actorId,
    generatedAt: generatedAt.toISOString(),
  };
}

export function summarizeExportContext(context: ResolvedDrugExportContextV1): Record<string, string | number | boolean | null> {
  return {
    schemaVersion: context.schemaVersion,
    locale: context.locale,
    sourceRoute: context.sourceRoute,
    fiscalYearBe: context.period?.fiscalYearBe ?? null,
    dateFrom: context.period?.dateFrom ?? null,
    dateTo: context.period?.dateTo ?? null,
    hqId: context.organization?.hqId ?? null,
    regionId: context.organization?.regionId ?? null,
    battalionId: context.organization?.battalionId ?? null,
    companyId: context.organization?.companyId ?? null,
    province: context.geo?.province ?? null,
    district: context.geo?.district ?? null,
    status: context.geo?.status ?? null,
    completeness: context.completeness ?? null,
    boardId: context.board?.boardId ?? null,
    networkFocusType: context.network?.focusType ?? null,
    mapViewMode: context.map?.viewMode ?? null,
  };
}
