/**
 * Zod schemas for GET /api/drug-intelligence/network/compare (LC-2A).
 * Identity is type + id only — never display labels.
 */

import { z } from "zod";

const MAX_FIELD = 500;

export const drugLinkCompareEntityTypeSchema = z.enum(["PERSON", "CASE", "PHONE", "SIM", "DEVICE", "VEHICLE"]);

export const drugLinkCompareQuerySchema = z
  .object({
    actorId: z.string().trim().min(1),
    aType: drugLinkCompareEntityTypeSchema,
    aId: z.string().trim().min(1).max(MAX_FIELD),
    bType: drugLinkCompareEntityTypeSchema,
    bId: z.string().trim().min(1).max(MAX_FIELD),
    cType: drugLinkCompareEntityTypeSchema.optional(),
    cId: z.string().trim().min(1).max(MAX_FIELD).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cType) !== Boolean(value.cId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cType and cId must be provided together",
        path: value.cType ? ["cId"] : ["cType"],
      });
    }
  });
