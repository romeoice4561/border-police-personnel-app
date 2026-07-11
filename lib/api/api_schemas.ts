/**
 * API request validation schemas (Phase 13, Zod).
 *
 * Zod schemas that parse and validate URL query parameters for each endpoint,
 * with sane defaults and bounded pagination (protects the DB from unbounded
 * result sets). Query values arrive as strings, so numeric/enum coercion lives
 * here — route handlers receive already-validated, typed params.
 *
 * Pure schema definitions — no I/O, no Next internals.
 */

import { z } from "zod";

/** Max page size the API will ever return in one request. */
export const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

const officerSortFieldSchema = z
  .enum(["lastName", "firstName", "rank", "careerYears", "qualityScore", "knowledgeScore", "createdAt"])
  .default("createdAt");

const matchModeSchema = z.enum(["contains", "startsWith", "exact"]).default("contains");

/** The 4-value Timeline verification status closed set (Phase 26B Part 5 Part D/H) — duplicated here as a literal union (not imported) to keep this schema module dependency-free of the officer_profile domain. */
const verificationStatusFilterSchema = z.enum(["VERIFIED", "PENDING", "REJECTED", "NEEDS_REVIEW"]).optional();

/** Accepts "true"/"false" query-string values as a real boolean; anything else (including absent) stays undefined. */
const booleanQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

/** GET /officers query params. */
export const officerListQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  sortBy: officerSortFieldSchema,
  sortOrder: sortOrderSchema,
  rank: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  minQuality: z.coerce.number().int().min(0).max(100).optional(),
  minCareerYears: z.coerce.number().int().min(0).optional(),
  // Phase 20C: optional Organization master-data filters (helper references — additive).
  headquartersId: z.coerce.number().int().positive().optional(),
  regionId: z.coerce.number().int().positive().optional(),
  battalionId: z.coerce.number().int().positive().optional(),
  companyId: z.coerce.number().int().positive().optional(),
  // Phase 26B Part 6 Part M: new Officers-list filters.
  verificationStatus: verificationStatusFilterSchema,
  hasPortrait: booleanQuerySchema,
  hasPhone: booleanQuerySchema,
});

/** GET /search query params. At least one search field must be present. */
export const officerSearchQuerySchema = officerListQuerySchema
  .extend({
    match: matchModeSchema,
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    position: z.string().trim().min(1).optional(),
  })
  .refine(
    (q) =>
      Boolean(
        q.name ||
          q.rank ||
          q.unit ||
          q.phone ||
          q.position ||
          q.region ||
          q.minCareerYears !== undefined ||
          q.minQuality !== undefined
      ),
    { message: "Provide at least one search parameter (name, rank, unit, phone, position, region, minCareerYears, or minQuality)." }
  );

/** GET /officers/{id} path param. */
export const officerIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

/**
 * Phase 26B Part B: GET /api/search/global query params — one free-text `q`
 * spanning every field the spec lists (see GlobalSearchService). Deliberately
 * separate from officerSearchQuerySchema (the existing per-field form) —
 * global search has no match-mode selector (always contains) and no
 * per-field inputs, only paging/sort + `q`.
 */
export const globalSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Provide a search query."),
  page: pageSchema,
  pageSize: pageSizeSchema,
  sortBy: officerSortFieldSchema,
  sortOrder: sortOrderSchema,
});

export type OfficerListQuery = z.infer<typeof officerListQuerySchema>;
export type OfficerSearchQuery = z.infer<typeof officerSearchQuerySchema>;
export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;

/** Parses URLSearchParams into a plain record for Zod (last value wins on repeats). */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}
