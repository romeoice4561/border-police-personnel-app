/**
 * Gallery API handlers (Phase 19C).
 *
 * The framework-agnostic core of each Gallery endpoint: functions that take an
 * AssetService + already-parsed inputs (or raw URLSearchParams) and return a
 * Web Response. Route handlers under app/api/gallery/ are thin adapters that
 * build the container and delegate here — so every endpoint is unit-testable
 * with a fake service and no running server.
 *
 * ALL filtering/paging/sorting lives in AssetService (the API only validates
 * and shapes the response); there is no duplicated filtering logic here. PROFILE
 * is excluded by the service, so it can never be returned. Zod validation and
 * the shared consistent envelope (api_response) are reused.
 */

import { z } from "zod";
import { badRequest, jsonOk, notFound } from "@/lib/api/api_response";
import type { AssetService } from "@/lib/gallery/asset_service";
import type { AssetCategory } from "@/lib/gallery/asset_category";
import {
  galleryAssetIdParamSchema,
  galleryAssetsQuerySchema,
  galleryCompaniesQuerySchema,
  galleryRegionsQuerySchema,
  searchParamsToObject,
} from "@/lib/gallery/gallery_api_schemas";

function zodDetails(error: z.ZodError): unknown {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/**
 * GET /api/gallery/assets — filtered/sorted/paginated list plus the facet
 * counts (category/region/company) that drive the Gallery's filter flow. The
 * facets are scoped to the SAME filters as the list (so the counts reflect the
 * current view). Response shape: { data: items, meta: { pagination, facetCounts } }.
 */
export async function handleGalleryAssets(service: AssetService, params: URLSearchParams): Promise<Response> {
  const parsed = galleryAssetsQuerySchema.safeParse(searchParamsToObject(params));
  if (!parsed.success) return badRequest("Invalid gallery query parameters", zodDetails(parsed.error));

  const q = parsed.data;

  // All data access goes through the service — no filtering logic here.
  const [page, categories, regions, companies] = await Promise.all([
    service.list(q),
    service.categoryCounts(),
    service.regionCounts(q.category),
    service.companyCounts({ category: q.category, region: q.region }),
  ]);

  return jsonOk(page.data, {
    pagination: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    },
    facetCounts: {
      categories,
      regions,
      companies,
    },
    filters: {
      category: q.category ?? null,
      region: q.region ?? null,
      company: q.company ?? null,
      battalion: q.battalion ?? null,
      search: q.search ?? null,
      match: q.match,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder,
    },
  });
}

/** GET /api/gallery/assets/{assetId} — one asset (PROFILE never returned → 404). */
export async function handleGalleryAssetById(service: AssetService, rawAssetId: string): Promise<Response> {
  const parsed = galleryAssetIdParamSchema.safeParse({ assetId: rawAssetId });
  if (!parsed.success) return badRequest("Invalid asset id", zodDetails(parsed.error));

  const asset = await service.getById(parsed.data.assetId);
  if (!asset) return notFound(`Asset '${parsed.data.assetId}' not found`);

  return jsonOk(asset);
}

/** GET /api/gallery/categories — Gallery category facets (reserved PROFILE excluded). */
export async function handleGalleryCategories(service: AssetService): Promise<Response> {
  const categories = await service.categoryCounts();
  return jsonOk(categories, { total: categories.length });
}

/** GET /api/gallery/regions — region facets, optionally scoped to ?category. */
export async function handleGalleryRegions(service: AssetService, params: URLSearchParams): Promise<Response> {
  const parsed = galleryRegionsQuerySchema.safeParse(searchParamsToObject(params));
  if (!parsed.success) return badRequest("Invalid gallery query parameters", zodDetails(parsed.error));

  const regions = await service.regionCounts(parsed.data.category as AssetCategory | undefined);
  return jsonOk(regions, { total: regions.length, category: parsed.data.category ?? null });
}

/** GET /api/gallery/companies — company facets, optionally scoped to ?category & ?region. */
export async function handleGalleryCompanies(service: AssetService, params: URLSearchParams): Promise<Response> {
  const parsed = galleryCompaniesQuerySchema.safeParse(searchParamsToObject(params));
  if (!parsed.success) return badRequest("Invalid gallery query parameters", zodDetails(parsed.error));

  const companies = await service.companyCounts({
    category: parsed.data.category as AssetCategory | undefined,
    region: parsed.data.region,
  });
  return jsonOk(companies, { total: companies.length });
}
