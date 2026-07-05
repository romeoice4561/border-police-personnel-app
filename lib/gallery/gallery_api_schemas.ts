/**
 * Gallery API request validation (Phase 19C, Zod).
 *
 * Parses/validates the query parameters for the Gallery endpoints into typed,
 * bounded values (bounded pagination protects the DB). Query strings arrive as
 * text, so coercion/enum-narrowing lives here — the handlers receive already-
 * validated params and pass them straight to AssetService (no filtering logic
 * in the API layer).
 *
 * Pure schema definitions — no I/O, no Next internals.
 */

import { z } from "zod";
import { AssetCategory } from "@/lib/gallery/asset_category";

/** Max page size the Gallery API will return in one request. */
export const MAX_GALLERY_PAGE_SIZE = 100;
const DEFAULT_GALLERY_PAGE_SIZE = 24;

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(MAX_GALLERY_PAGE_SIZE).default(DEFAULT_GALLERY_PAGE_SIZE);
const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

/** Sortable asset fields (whitelisted — never a raw client column). */
const sortBySchema = z.enum(["folderName", "region", "company", "createdTime", "updatedTime"]).default("folderName");

const matchSchema = z.enum(["contains", "startsWith", "exact"]).default("contains");

/** AssetCategory values accepted from the client (PROFILE is accepted but the service returns it empty). */
const categorySchema = z.nativeEnum(AssetCategory);

/** GET /api/gallery/assets query params. */
export const galleryAssetsQuerySchema = z.object({
  category: categorySchema.optional(),
  region: z.string().trim().min(1).optional(),
  company: z.string().trim().min(1).optional(),
  battalion: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  match: matchSchema,
  page: pageSchema,
  pageSize: pageSizeSchema,
  sortBy: sortBySchema,
  sortOrder: sortOrderSchema,
});

/** GET /api/gallery/regions query params (optional category scope). */
export const galleryRegionsQuerySchema = z.object({
  category: categorySchema.optional(),
});

/** GET /api/gallery/companies query params (optional category + region scope). */
export const galleryCompaniesQuerySchema = z.object({
  category: categorySchema.optional(),
  region: z.string().trim().min(1).optional(),
});

/** GET /api/gallery/assets/{assetId} path param. */
export const galleryAssetIdParamSchema = z.object({
  assetId: z.string().trim().min(1),
});

export type GalleryAssetsQuery = z.infer<typeof galleryAssetsQuerySchema>;

/** Parses URLSearchParams into a plain record for Zod (last value wins on repeats). */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}
