/**
 * POST /api/drug-intelligence/exports request schema.
 * actorId is used only to resolve the session user. Context actorId/generatedAt
 * from the client are ignored.
 */

import { z } from "zod";
import { drugExportContextV1InputSchema } from "@/lib/drug_intelligence/drug_export_context";
import {
  DRUG_EXPORT_FORMATS,
  DRUG_EXPORT_INTENTS,
  DRUG_EXPORT_MASKING_MODES,
  DRUG_EXPORT_PRESETS,
  DRUG_EXPORT_TYPES,
} from "@/lib/drug_intelligence/drug_export_types";

export const drugExportRequestSchema = z.object({
  actorId: z.string().trim().min(1).max(80),
  intent: z.enum(DRUG_EXPORT_INTENTS).default("DOWNLOAD"),
  exportType: z.enum(DRUG_EXPORT_TYPES),
  format: z.enum(DRUG_EXPORT_FORMATS),
  context: drugExportContextV1InputSchema,
  preset: z.enum(DRUG_EXPORT_PRESETS).optional(),
  columns: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
  masking: z.enum(DRUG_EXPORT_MASKING_MODES).optional(),
});

export type DrugExportRequestBody = z.infer<typeof drugExportRequestSchema>;
