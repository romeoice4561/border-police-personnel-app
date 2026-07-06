/**
 * Gallery React Query hooks (Phase 19D).
 *
 * One hook per Gallery data concern: categories (home screen) and assets
 * (browser grid + filter facets). Hooks are the ONLY place gallery
 * components fetch — all filtering logic stays in AssetService on the server.
 *
 * "use client" — only consumed by client components.
 */
"use client";

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { galleryClient, type GalleryAssetsQuery, type GalleryAssetsResult } from "@/lib/gallery/gallery_client";
import type { AssetCategoryCount } from "@/lib/gallery/asset_types";

export const galleryQueryKeys = {
  categories: () => ["gallery", "categories"] as const,
  assets: (query: GalleryAssetsQuery) => ["gallery", "assets", query] as const,
};

export function useGalleryCategories(): UseQueryResult<AssetCategoryCount[]> {
  return useQuery({
    queryKey: galleryQueryKeys.categories(),
    queryFn: () => galleryClient.listCategories(),
  });
}

export function useGalleryAssets(query: GalleryAssetsQuery): UseQueryResult<GalleryAssetsResult> {
  return useQuery({
    queryKey: galleryQueryKeys.assets(query),
    queryFn: () => galleryClient.listAssets(query),
    placeholderData: keepPreviousData,
  });
}
