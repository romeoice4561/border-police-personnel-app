/**
 * Zod schemas for the DI-7.4 Advanced Person Search API surface.
 * Mirrors drug_person_api_schemas.ts conventions (trimmed strings,
 * coerce for numerics, comma-separated arrays from query params).
 */

import { z } from "zod";

function parsePersonSearchDate(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`
    : value;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }
  return parsed;
}

export const drugPersonAdvancedSearchSchema = z.object({
  actorId: z.string().trim().min(1),
  query: z.string().trim().max(300).optional(),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
  nationality: z.string().trim().max(100).optional(),
  ageMin: z.coerce.number().int().min(0).max(150).optional(),
  ageMax: z.coerce.number().int().min(0).max(150).optional(),
  /** Comma-separated network group IDs. */
  networkGroupIds: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .optional(),
  /** Comma-separated network role values (e.g. COURIER,RUNNER). */
  networkRoles: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .optional(),
  /** Comma-separated network role source values. */
  networkRoleSources: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .optional(),
  /** Comma-separated verification status values. */
  verificationStatuses: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .optional(),
  /** Comma-separated DrugCasePerson.role values. */
  caseRoles: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .optional(),
  minCaseCount: z.coerce.number().int().min(1).optional(),
  dateFrom: z
    .string()
    .optional()
    .transform((v) => parsePersonSearchDate(v, false)),
  dateTo: z
    .string()
    .optional()
    .transform((v) => parsePersonSearchDate(v, true)),
  province: z.string().trim().max(100).optional(),
  battalionId: z.coerce.number().int().optional(),
  companyId: z.coerce.number().int().optional(),
  sort: z
    .enum(["RELEVANCE", "NAME_ASC", "CASE_COUNT_DESC", "LAST_SEEN_DESC", "AGE_ASC", "AGE_DESC"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type DrugPersonAdvancedSearchSchemaInput = z.input<typeof drugPersonAdvancedSearchSchema>;
export type DrugPersonAdvancedSearchSchemaParsed = z.output<typeof drugPersonAdvancedSearchSchema>;
