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
import { badRequest, jsonError, jsonOk, notFound } from "@/lib/api/api_response";
import type { AssetService } from "@/lib/gallery/asset_service";
import type { AssetCategory } from "@/lib/gallery/asset_category";
import {
  asciiFallbackDownloadFilename,
  extensionFromPath,
  galleryAssetDownloadFilename,
  galleryAssetUpstreamImageUrls,
  mimeTypeFromExtension,
} from "@/lib/gallery/gallery_download";
import {
  galleryAssetIdParamSchema,
  galleryAssetsQuerySchema,
  galleryCompaniesQuerySchema,
  galleryMetadataPatchSchema,
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
  const verifiedOpt = q.verified !== undefined ? { verified: q.verified } : undefined;
  const [page, categories, regions, companies] = await Promise.all([
    service.list(q),
    service.categoryCounts(),
    service.regionCounts(q.category, verifiedOpt),
    service.companyCounts({ category: q.category, region: q.region, ...verifiedOpt }),
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
      companyId: q.companyId ?? null,
      search: q.search ?? null,
      verified: q.verified ?? null,
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

/**
 * GET /api/gallery/assets/{assetId}/download — proxy the asset image bytes with
 * Content-Disposition: attachment so the browser downloads immediately.
 *
 * Client-side fetch of Drive thumbnail URLs fails CORS and cross-origin
 * `<a download>` is ignored by browsers — this same-origin proxy is required.
 */
export async function handleDownloadGalleryAsset(
  service: AssetService,
  rawAssetId: string
): Promise<Response> {
  const parsed = galleryAssetIdParamSchema.safeParse({ assetId: rawAssetId });
  if (!parsed.success) return badRequest("Invalid asset id", zodDetails(parsed.error));

  const asset = await service.getById(parsed.data.assetId);
  if (!asset) return notFound(`Asset '${parsed.data.assetId}' not found`);

  const upstreamUrls = galleryAssetUpstreamImageUrls(asset);
  if (upstreamUrls.length === 0) {
    return notFound(`Asset '${parsed.data.assetId}' has no downloadable image`);
  }

  let lastStatus = 0;
  for (const url of upstreamUrls) {
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(url, { cache: "no-store", redirect: "follow" });
    } catch {
      continue;
    }
    lastStatus = upstream.status;
    if (!upstream.ok) continue;

    let buffer: ArrayBuffer;
    try {
      buffer = await upstream.arrayBuffer();
    } catch {
      continue;
    }
    if (buffer.byteLength === 0) continue;

    const filename = galleryAssetDownloadFilename(asset);
    const ext = extensionFromPath(filename, "jpg");
    const mimeType =
      upstream.headers.get("content-type")?.split(";")[0]?.trim() || mimeTypeFromExtension(ext);
    const safeFilename = asciiFallbackDownloadFilename(filename, mimeType);

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition":
          `attachment; filename="${safeFilename}"; ` +
          `filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  }

  return jsonError(
    "STORAGE",
    lastStatus ? `File not available (${lastStatus}).` : "Could not reach image storage.",
    502
  );
}

/**
 * Phase 22A: PATCH /api/gallery/assets/{assetId} — updates only the editable
 * metadata fields. Returns 404 when the asset is absent or reserved (PROFILE).
 */
export async function handleUpdateAssetMetadata(
  service: AssetService,
  rawAssetId: string,
  request: Request
): Promise<Response> {
  const paramParsed = galleryAssetIdParamSchema.safeParse({ assetId: rawAssetId });
  if (!paramParsed.success) return badRequest("Invalid asset id", zodDetails(paramParsed.error));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const bodyParsed = galleryMetadataPatchSchema.safeParse(body);
  if (!bodyParsed.success) return badRequest("Invalid metadata patch", zodDetails(bodyParsed.error));

  const updated = await service.updateMetadata(paramParsed.data.assetId, bodyParsed.data);
  if (!updated) return notFound(`Asset '${paramParsed.data.assetId}' not found`);

  return jsonOk(updated);
}
