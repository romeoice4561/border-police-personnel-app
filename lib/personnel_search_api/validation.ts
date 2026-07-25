/**
 * Request validation for Personnel Search API (Phase 51.1).
 * Uses Zod to match repository API conventions.
 */
import { z } from "zod";
import { SEARCH_INTENTS } from "@/lib/personnel_search/types";
import {
  API_SEARCH_CLIENTS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_QUERY_LENGTH,
  type PersonnelSearchApiRequestBody,
} from "@/lib/personnel_search_api/contracts";
import { PersonnelSearchApiError } from "@/lib/personnel_search_api/errors";

const unitScopeSchema = z
  .object({
    regionCode: z.string().trim().min(1).max(32).optional(),
    divisionCode: z.string().trim().min(1).max(32).optional(),
    companyCode: z.string().trim().min(1).max(32).optional(),
  })
  .strict()
  .optional();

export const personnelSearchApiBodySchema = z
  .object({
    query: z.string(),
    disclosureLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    intentHint: z.enum(SEARCH_INTENTS).optional(),
    unitScope: unitScopeSchema,
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
    client: z.enum(API_SEARCH_CLIENTS).optional(),
  })
  .strict();

export interface ValidatedPersonnelSearchApiRequest {
  query: string;
  disclosureLevel: 1 | 2 | 3;
  intentHint?: PersonnelSearchApiRequestBody["intentHint"];
  unitScope?: PersonnelSearchApiRequestBody["unitScope"];
  cursor?: string;
  limit: number;
  client: (typeof API_SEARCH_CLIENTS)[number];
}

export function validatePersonnelSearchApiBody(raw: unknown): ValidatedPersonnelSearchApiRequest {
  const parsed = personnelSearchApiBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.join(".") || undefined;
    if (field === "disclosureLevel") {
      throw new PersonnelSearchApiError("INVALID_DISCLOSURE_LEVEL", "disclosureLevel must be 1, 2, or 3", 400, "disclosureLevel");
    }
    if (field === "limit") {
      throw new PersonnelSearchApiError("INVALID_REQUEST", `limit must be between 1 and ${MAX_LIMIT}`, 400, "limit");
    }
    if (field === "client") {
      throw new PersonnelSearchApiError("INVALID_REQUEST", "client is not allow-listed", 400, "client");
    }
    throw new PersonnelSearchApiError("INVALID_REQUEST", issue?.message ?? "Invalid request body", 400, field);
  }

  const query = parsed.data.query.replace(/\s+/g, " ").trim();
  if (query.length > MAX_QUERY_LENGTH) {
    throw new PersonnelSearchApiError(
      "QUERY_TOO_LONG",
      `query must be at most ${MAX_QUERY_LENGTH} characters`,
      400,
      "query"
    );
  }

  const isHelp = /^(help|ช่วยเหลือ|วิธีใช้|คำสั่ง|เมนู|\?)$/i.test(query);
  if (!query && !isHelp && parsed.data.intentHint !== "HELP") {
    throw new PersonnelSearchApiError("INVALID_REQUEST", "query must not be empty", 400, "query");
  }

  return {
    query: query || "help",
    disclosureLevel: parsed.data.disclosureLevel ?? 1,
    intentHint: parsed.data.intentHint,
    unitScope: parsed.data.unitScope,
    cursor: parsed.data.cursor,
    limit: parsed.data.limit ?? DEFAULT_LIMIT,
    client: parsed.data.client ?? "web",
  };
}

export function mapApiClientToGatewayClient(
  client: (typeof API_SEARCH_CLIENTS)[number]
): "web" | "telegram" | "line" | "api" {
  if (client === "internal") return "api";
  return client;
}
