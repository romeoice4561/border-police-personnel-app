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
  // Phase 49A.3A: when search or verified filter is active, do NOT keep
  // previous-page results as placeholder — that made stale cards linger
  // (e.g. unverified "414" hits while verified-only loaded). Plain category
  // browsing still uses keepPreviousData for smoother pagination.
  const skipPlaceholder = Boolean(query.search?.trim()) || query.verified === true;
  return useQuery({
    queryKey: galleryQueryKeys.assets(query),
    queryFn: () => galleryClient.listAssets(query),
    placeholderData: skipPlaceholder ? undefined : keepPreviousData,
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
