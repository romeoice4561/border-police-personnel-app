/**
 * GalleryBrowser (Phase 19D; Thai polish + sort + search expansion Phase 19F;
 * metadata editor + battalion/verified filters Phase 22A).
 *
 * Category browser: cascading region → battalion → company filters, verified
 * toggle, search, sort selector, responsive asset grid, pagination, one shared
 * PhotoModal (viewer) and one GalleryEditModal (metadata editor). All UI text
 * is Thai.
 */
"use client";

import { useState, useCallback, useDeferredValue } from "react";
import { ChevronLeft, Search, X, ArrowUpDown, ShieldCheck } from "lucide-react";
import { ASSET_CATEGORY_LABELS } from "@/lib/gallery/asset_category";
import type { AssetCategory } from "@/lib/gallery/asset_category";
import type { Asset } from "@/lib/gallery/asset_types";
import { useGalleryAssets } from "@/lib/gallery/gallery_hooks";
import { GalleryAssetCard } from "@/components/gallery/gallery_asset_card";
import { GalleryEditModal } from "@/components/gallery/gallery_edit_modal";
import { PhotoModal } from "@/components/officer/photo_modal";
import { Skeleton, ErrorState, EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

const PAGE_SIZE = 24;

const controlClass =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/** Sort option: value encodes "sortBy:sortOrder" to keep state minimal. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "folderName:asc",    label: "ชื่อ ก–ฮ" },
  { value: "region:asc",        label: "ภาค น้อย–มาก" },
  { value: "company:asc",       label: "กองร้อย" },
  { value: "updatedTime:desc",  label: "ล่าสุด" },
  { value: "createdTime:asc",   label: "เก่าสุด" },
];

const DEFAULT_SORT = "folderName:asc";

function parseSortValue(value: string): { sortBy: string; sortOrder: "asc" | "desc" } {
  const [sortBy, sortOrder] = value.split(":");
  return { sortBy, sortOrder: (sortOrder as "asc" | "desc") ?? "asc" };
}

/** Derives a display name for an asset (folder name, then last path segment, then id). */
function assetDisplayName(asset: Asset): string {
  return asset.folderName ?? asset.relativePath.split("/").pop() ?? asset.assetId;
}

/** Compact metadata line: "ชื่อ · ภาค N · ตชด.NNN · กก.ตชด.NN". */
function assetMetaLine(asset: Asset): string {
  return [asset.region, asset.company, asset.battalion]
    .filter(Boolean)
    .join(" · ");
}

interface GalleryBrowserProps {
  category: AssetCategory;
  onBack: () => void;
}

export function GalleryBrowser({ category, onBack }: GalleryBrowserProps) {
  const [region, setRegion]           = useState("");
  const [battalion, setBattalion]     = useState("");
  const [company, setCompany]         = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [sortValue, setSortValue]     = useState(DEFAULT_SORT);
  const [page, setPage]               = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editAsset, setEditAsset]     = useState<Asset | null>(null);

  // Defer the search string so typing doesn't fire a new request on every keystroke.
  const search = useDeferredValue(searchInput);

  const { sortBy, sortOrder } = parseSortValue(sortValue);

  const query = {
    category,
    region:    region    || undefined,
    battalion: battalion || undefined,
    company:   company   || undefined,
    verified:  verifiedOnly ? true : undefined,
    search:    search    || undefined,
    sortBy,
    sortOrder,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isPending, isError, error, refetch } = useGalleryAssets(query);

  const handleRegionChange = useCallback((value: string) => {
    setRegion(value);
    setCompany("");
    setPage(1);
  }, []);

  const handleBattalionChange = useCallback((value: string) => {
    setBattalion(value);
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

  const handleSortChange = useCallback((value: string) => {
    setSortValue(value);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setRegion("");
    setBattalion("");
    setCompany("");
    setVerifiedOnly(false);
    setSearchInput("");
    setSortValue(DEFAULT_SORT);
    setPage(1);
  }, []);

  const regions    = data?.facetCounts.regions   ?? [];
  const companies  = data?.facetCounts.companies ?? [];
  const assets     = data?.data ?? [];
  const pagination = data?.pagination;

  const hasFilters = Boolean(region || battalion || company || verifiedOnly || searchInput || sortValue !== DEFAULT_SORT);
  const categoryLabel = ASSET_CATEGORY_LABELS[category];

  // Total count label
  const totalLabel =
    pagination === undefined
      ? null
      : pagination.total === 0
        ? "ไม่มีรายการ"
        : `${pagination.total} รายการ`;

  return (
    <div className="space-y-5">
      {/* ── Header: back button + category title + count ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label="ย้อนกลับไปหน้าหมวดหมู่"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          ย้อนกลับ
        </Button>
        <h2 className="text-lg font-semibold text-foreground">{categoryLabel}</h2>
        {totalLabel ? (
          <span className="ml-auto text-sm text-muted">{totalLabel}</span>
        ) : null}
      </div>

      {/* ── Filter + sort bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Region */}
        <label className="sr-only" htmlFor="gallery-region-select">ภาค</label>
        <select
          id="gallery-region-select"
          className={cn(controlClass, "min-w-[130px]")}
          value={region}
          onChange={(e) => handleRegionChange(e.target.value)}
          disabled={isPending && regions.length === 0}
          aria-label="กรองตามภาค"
        >
          <option value="">ทุกภาค</option>
          {regions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.value} ({r.count})
            </option>
          ))}
        </select>

        {/* Battalion — free-text filter (Phase 22A) */}
        <div className="relative">
          <input
            type="text"
            id="gallery-battalion-input"
            placeholder="กองกำกับ..."
            value={battalion}
            onChange={(e) => handleBattalionChange(e.target.value)}
            className={cn(controlClass, "min-w-[130px]", battalion ? "pr-7" : "pr-3")}
            aria-label="กรองตามกองกำกับ"
          />
          {battalion ? (
            <button
              type="button"
              onClick={() => handleBattalionChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label="ล้างตัวกรองกองกำกับ"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Company — shown when facet has options or a value is already selected */}
        {(companies.length > 0 || company) ? (
          <>
            <label className="sr-only" htmlFor="gallery-company-select">กองร้อย</label>
            <select
              id="gallery-company-select"
              className={cn(controlClass, "min-w-[130px]")}
              value={company}
              onChange={(e) => handleCompanyChange(e.target.value)}
              aria-label="กรองตามกองร้อย"
            >
              <option value="">ทุกกองร้อย</option>
              {companies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value} ({c.count})
                </option>
              ))}
            </select>
          </>
        ) : null}

        {/* Verified toggle (Phase 22A) */}
        <button
          type="button"
          onClick={() => { setVerifiedOnly((v) => !v); setPage(1); }}
          className={cn(
            controlClass,
            "inline-flex items-center gap-1.5 transition-colors",
            verifiedOnly
              ? "border-good bg-good-bg text-good"
              : "text-muted hover:text-foreground"
          )}
          aria-pressed={verifiedOnly}
          aria-label="แสดงเฉพาะรายการที่ยืนยันแล้ว"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          ยืนยันแล้ว
        </button>

        {/* Search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="ค้นหา..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={cn(controlClass, "pl-8", searchInput ? "pr-8" : "pr-3")}
            aria-label="ค้นหาข้อมูลภาพ"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label="ล้างการค้นหา"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Sort */}
        <div className="relative flex items-center">
          <ArrowUpDown
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="gallery-sort-select">เรียงลำดับ</label>
          <select
            id="gallery-sort-select"
            className={cn(controlClass, "pl-8 min-w-[130px]")}
            value={sortValue}
            onChange={(e) => handleSortChange(e.target.value)}
            aria-label="เรียงลำดับผลลัพธ์"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear all filters */}
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={handleClearFilters} aria-label="ล้างตัวกรองทั้งหมด">
            ล้างตัวกรอง
          </Button>
        ) : null}
      </div>

      {/* ── Asset grid ── */}
      <section
        aria-label={`รายการ ${categoryLabel}`}
        aria-live="polite"
        aria-busy={isPending}
      >
        {isError ? (
          <ErrorState
            title="โหลดข้อมูลไม่สำเร็จ"
            message={(error as Error).message}
            onRetry={() => refetch()}
          />
        ) : isPending ? (
          <GalleryGridSkeleton />
        ) : assets.length === 0 ? (
          <EmptyState
            title="ไม่พบข้อมูล"
            message={
              hasFilters
                ? "ลองเปลี่ยนตัวกรองหรือคำค้นหาด้วยคำอื่น"
                : "ยังไม่มีข้อมูลภาพในหมวดหมู่นี้"
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <GalleryAssetCard
                key={asset.assetId}
                asset={asset}
                onOpen={setSelectedAsset}
                onEdit={setEditAsset}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Pagination ── */}
      {pagination && pagination.totalPages > 1 ? (
        <nav
          className="flex items-center justify-center gap-3"
          aria-label="การแบ่งหน้า"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="หน้าก่อนหน้า"
          >
            ก่อนหน้า
          </Button>
          <span className="text-sm text-muted" aria-live="polite">
            หน้า {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            aria-label="หน้าถัดไป"
          >
            ถัดไป
          </Button>
        </nav>
      ) : null}

      {/* ── Metadata edit modal (Phase 22A) ── */}
      {editAsset ? (
        <GalleryEditModal
          asset={editAsset}
          onClose={() => setEditAsset(null)}
        />
      ) : null}

      {/* ── Photo viewer modal (one instance for the whole grid) ── */}
      {selectedAsset ? (
        <PhotoModal
          open={true}
          onClose={() => setSelectedAsset(null)}
          photo={{
            driveFileId:  selectedAsset.driveFileId,
            thumbnailUrl: selectedAsset.thumbnailUrl,
            webViewUrl:   selectedAsset.webViewUrl,
          }}
          name={assetDisplayName(selectedAsset)}
          title={
            // Pass rich metadata as ReactNode — displayed in the top bar.
            // Spans are inline so the parent <p className="truncate"> clips gracefully.
            <>
              <span className="font-medium">{assetDisplayName(selectedAsset)}</span>
              {assetMetaLine(selectedAsset) ? (
                <span className="ml-2 text-xs font-normal opacity-60">
                  {assetMetaLine(selectedAsset)}
                </span>
              ) : null}
            </>
          }
        />
      ) : null}
    </div>
  );
}

/** Skeleton grid shown while the first page of assets loads. */
function GalleryGridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4"
      aria-hidden="true"
      aria-label="กำลังโหลด..."
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 px-3 py-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
