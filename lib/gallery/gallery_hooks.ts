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

import { useQuery, useMutation, useQueryClient, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { galleryClient, type GalleryAssetsQuery, type GalleryAssetsResult } from "@/lib/gallery/gallery_client";
import type { Asset, AssetCategoryCount, AssetMetadataPatch } from "@/lib/gallery/asset_types";

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
  // Phase 49A.3: when a search keyword is active, do NOT keep previous-page
  // results as placeholder — that made stale "414" cards linger while the
  // next query loaded. Category browsing without search still uses
  // keepPreviousData for smoother pagination.
  const hasSearch = Boolean(query.search?.trim());
  return useQuery({
    queryKey: galleryQueryKeys.assets(query),
    queryFn: () => galleryClient.listAssets(query),
    placeholderData: hasSearch ? undefined : keepPreviousData,
  });
}

/**
 * Phase 22A: mutation hook for updating asset metadata. On success, all
 * gallery queries are invalidated so the grid reflects the latest values.
 */
export function useUpdateAssetMetadata() {
  const queryClient = useQueryClient();
  return useMutation<Asset, Error, { assetId: string; patch: AssetMetadataPatch }>({
    mutationFn: ({ assetId, patch }) => galleryClient.updateAssetMetadata(assetId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gallery"] });
    },
  });
}
