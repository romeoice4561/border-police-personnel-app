/**
 * Gallery API client (Phase 19D).
 *
 * Typed fetch wrappers over the Gallery REST endpoints. Mirrors the officer
 * api_client pattern: unwraps the { data, meta } envelope, throws
 * ApiClientError on failure. "use client" — only consumed by browser
 * components via React Query hooks.
 */
"use client";

import type { Asset, AssetCategoryCount, AssetFacetCount } from "@/lib/gallery/asset_types";
import type { AssetCategory } from "@/lib/gallery/asset_category";
import { ApiClientError } from "@/lib/ui/api_client";

export interface GalleryAssetsQuery {
  category?: AssetCategory;
  region?: string;
  company?: string;
  battalion?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface GalleryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GalleryFacetCounts {
  categories: AssetCategoryCount[];
  regions: AssetFacetCount[];
  companies: AssetFacetCount[];
}

export interface GalleryAssetsResult {
  data: Asset[];
  pagination: GalleryPagination;
  facetCounts: GalleryFacetCounts;
}

function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

interface ApiEnvelope<T> {
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string };
}

async function request<T>(path: string): Promise<{ data: T; meta?: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { headers: { Accept: "application/json" } });
  } catch (cause) {
    throw new ApiClientError("Network error — the server could not be reached.", 0, "NETWORK_ERROR", cause);
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status, "BAD_RESPONSE");
  }

  if (!response.ok || body.error) {
    const err = body.error;
    throw new ApiClientError(
      err?.message ?? `Request failed (${response.status})`,
      response.status,
      err?.code ?? "REQUEST_FAILED"
    );
  }

  return { data: body.data as T, meta: body.meta };
}

export const galleryClient = {
  async listCategories(): Promise<AssetCategoryCount[]> {
    return (await request<AssetCategoryCount[]>("/gallery/categories")).data;
  },

  async listAssets(query: GalleryAssetsQuery = {}): Promise<GalleryAssetsResult> {
    const { data, meta } = await request<Asset[]>(
      `/gallery/assets${toQueryString(query as Record<string, string | number | undefined | null>)}`
    );
    const m = meta as
      | {
          pagination?: GalleryPagination;
          facetCounts?: GalleryFacetCounts;
        }
      | undefined;
    return {
      data,
      pagination: m?.pagination ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 },
      facetCounts: m?.facetCounts ?? { categories: [], regions: [], companies: [] },
    };
  },
};
