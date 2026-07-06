/**
 * GalleryBrowser (Phase 19D).
 *
 * The category browser: filter bar (region, company, search) + responsive
 * asset grid + pagination. State is local to this component; filter changes
 * reset to page 1. One PhotoModal is mounted at this level — NOT duplicated
 * per card — and opened/closed via selectedAsset state.
 *
 * Filter population:
 *   - Regions  : facetCounts.regions  (scoped to selected category)
 *   - Companies: facetCounts.companies (scoped to selected category + region)
 *   These come from the same /assets response, so no extra requests are needed.
 */
"use client";

import { useState, useCallback, useDeferredValue } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import { ASSET_CATEGORY_LABELS } from "@/lib/gallery/asset_category";
import type { AssetCategory } from "@/lib/gallery/asset_category";
import type { Asset } from "@/lib/gallery/asset_types";
import { useGalleryAssets } from "@/lib/gallery/gallery_hooks";
import { GalleryAssetCard } from "@/components/gallery/gallery_asset_card";
import { PhotoModal } from "@/components/officer/photo_modal";
import { Skeleton, ErrorState, EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

const PAGE_SIZE = 24;

const controlClass =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

interface GalleryBrowserProps {
  category: AssetCategory;
  onBack: () => void;
}

export function GalleryBrowser({ category, onBack }: GalleryBrowserProps) {
  const [region, setRegion] = useState("");
  const [company, setCompany] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Defer the search string so typing doesn't fire a request on every keystroke.
  const search = useDeferredValue(searchInput);

  const query = {
    category,
    region: region || undefined,
    company: company || undefined,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isPending, isError, error, refetch } = useGalleryAssets(query);

  const handleRegionChange = useCallback((value: string) => {
    setRegion(value);
    setCompany("");
    setPage(1);
  }, []);

  const handleCompanyChange = useCallback((value: string) => {
    setCompany(value);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setRegion("");
    setCompany("");
    setSearchInput("");
    setPage(1);
  }, []);

  const regions = data?.facetCounts.regions ?? [];
  const companies = data?.facetCounts.companies ?? [];
  const assets = data?.data ?? [];
  const pagination = data?.pagination;
  const hasFilters = Boolean(region || company || searchInput);

  const categoryLabel = ASSET_CATEGORY_LABELS[category];

  return (
    <div className="space-y-5">
      {/* Header row: back button + category title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to gallery home">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <h2 className="text-lg font-semibold text-foreground">{categoryLabel}</h2>
        {pagination ? (
          <span className="ml-auto text-sm text-muted">
            {pagination.total === 0
              ? "No assets"
              : pagination.total === 1
                ? "1 asset"
                : `${pagination.total} assets`}
          </span>
        ) : null}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Region */}
        <label className="text-xs font-medium text-muted">
          <span className="sr-only">Region</span>
          <select
            className={cn(controlClass, "min-w-[120px]")}
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            disabled={isPending && regions.length === 0}
          >
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.value} ({r.count})
              </option>
            ))}
          </select>
        </label>

        {/* Company — only shown when the facet has options */}
        {(companies.length > 0 || company) ? (
          <label className="text-xs font-medium text-muted">
            <span className="sr-only">Company</span>
            <select
              className={cn(controlClass, "min-w-[120px]")}
              value={company}
              onChange={(e) => handleCompanyChange(e.target.value)}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value} ({c.count})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={cn(controlClass, "pl-8 pr-8")}
            aria-label="Search gallery assets"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Clear all filters */}
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {/* Gallery grid */}
      <section aria-label={`${categoryLabel} assets`} aria-live="polite" aria-busy={isPending}>
        {isError ? (
          <ErrorState
            message={(error as Error).message}
            onRetry={() => refetch()}
          />
        ) : isPending ? (
          <GalleryGridSkeleton />
        ) : assets.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No results" : "No gallery assets found."}
            message={
              hasFilters
                ? "Try adjusting or clearing your filters."
                : "No assets have been imported for this category yet."
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <GalleryAssetCard
                key={asset.assetId}
                asset={asset}
                onOpen={setSelectedAsset}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2" role="navigation" aria-label="Pagination">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      ) : null}

      {/* Full-screen photo viewer — one modal for the whole grid */}
      {selectedAsset ? (
        <PhotoModal
          open={true}
          onClose={() => setSelectedAsset(null)}
          photo={{
            driveFileId: selectedAsset.driveFileId,
            thumbnailUrl: selectedAsset.thumbnailUrl,
            webViewUrl: selectedAsset.webViewUrl,
          }}
          name={selectedAsset.folderName ?? selectedAsset.relativePath.split("/").pop() ?? selectedAsset.assetId}
          title={
            <span className="truncate">
              {selectedAsset.folderName ?? selectedAsset.relativePath.split("/").pop() ?? selectedAsset.assetId}
              {selectedAsset.region ? (
                <span className="ml-2 text-xs font-normal opacity-70">{selectedAsset.region}</span>
              ) : null}
            </span>
          }
        />
      ) : null}
    </div>
  );
}

/** Skeleton grid shown while the first page of assets is loading. */
function GalleryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 px-3 py-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
