/**
 * GalleryAssetCard (Phase 19D; badge polish Phase 19F; edit button Phase 22A).
 *
 * One card in the Gallery grid. Shows:
 *   - Thumbnail (stored Drive URL — no API call, lazy loaded)
 *   - Folder / display name as the card title
 *   - Small colored badges for region, company, and battalion
 *   - "(แก้ไข)" overlay button for the metadata editor (Phase 22A)
 *
 * Clicking the card calls onOpen(asset); clicking the edit button calls
 * onEdit(asset) — both modals are mounted at GalleryBrowser level.
 */
"use client";

import { Pencil } from "lucide-react";
import type { Asset } from "@/lib/gallery/asset_types";
import { isGalleryAssetVerified } from "@/lib/gallery/asset_search";
import { cn } from "@/lib/ui/cn";
import { GalleryImage } from "@/components/ui/media/GalleryImage";

interface GalleryAssetCardProps {
  asset: Asset;
  onOpen: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
}

export function GalleryAssetCard({ asset, onOpen, onEdit }: GalleryAssetCardProps) {
  const displayName  =
    asset.folderName ??
    asset.relativePath.split("/").pop() ??
    asset.assetId;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all hover:border-accent hover:shadow-md">
      {/* Main clickable area — opens the photo viewer */}
      <button
        type="button"
        onClick={() => onOpen(asset)}
        className="flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        aria-label={`เปิดรูป ${displayName}`}
      >
        {/* Thumbnail — fixed 4:3 aspect, uses shared GalleryImage (Phase 30.2) */}
        <div className="relative aspect-[4/3] w-full">
          <GalleryImage
            src={asset.thumbnailUrl}
            alt={displayName}
            hoverScale
            className="h-full w-full"
          />

          {/* Verified badge — same canonical predicate as the API filter. */}
          {isGalleryAssetVerified(asset) ? (
            <span
              className="absolute left-2 top-2 rounded-md bg-good-bg/90 px-1.5 py-0.5 text-[10px] font-semibold text-good"
              aria-label="ยืนยันแล้ว"
            >
              ✓
            </span>
          ) : null}
        </div>

        {/* Card metadata */}
        <div className="flex flex-col gap-2 p-4">
          {/* Folder / display name */}
          <p
            className="line-clamp-2 text-left text-sm font-medium leading-snug text-foreground group-hover:text-accent"
            title={displayName}
          >
            {displayName}
          </p>

          {/* Metadata badges */}
          {(asset.region || asset.company || asset.battalion) ? (
            <div className="flex flex-wrap gap-1">
              {asset.region ? (
                <span className="inline-flex items-center rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  {asset.region}
                </span>
              ) : null}
              {asset.company ? (
                <span className="inline-flex items-center rounded-md bg-good-bg px-1.5 py-0.5 text-[10px] font-medium text-good">
                  {asset.company}
                </span>
              ) : null}
              {asset.battalion ? (
                <span className="inline-flex items-center rounded-md bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-warning">
                  {asset.battalion}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </button>

      {/* Phase 22A: edit button — absolute top-right, visible on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit(asset); }}
        className={cn(
          "absolute right-2 top-2 flex items-center gap-1 rounded-md px-2 py-1",
          "bg-surface/90 text-[11px] font-medium text-muted shadow-sm backdrop-blur-sm",
          "opacity-0 transition-opacity group-hover:opacity-100",
          "hover:bg-accent hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        )}
        aria-label={`แก้ไขข้อมูล ${displayName}`}
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
        แก้ไข
      </button>
    </div>
  );
}
