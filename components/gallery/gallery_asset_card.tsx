/**
 * GalleryAssetCard (Phase 19D).
 *
 * One card in the Gallery grid: shows the asset thumbnail, folder name,
 * region, and company. Clicking the card calls onOpen so the parent can
 * mount the PhotoModal (one modal at GalleryBrowser level — not duplicated
 * per card).
 *
 * Thumbnail rendering:
 *   - Uses the stored thumbnailUrl (low-res preview, no API call).
 *   - Falls back to a neutral placeholder when no thumbnail is available or
 *     when the image errors.
 */
"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { Asset } from "@/lib/gallery/asset_types";
import { cn } from "@/lib/ui/cn";

interface GalleryAssetCardProps {
  asset: Asset;
  onOpen: (asset: Asset) => void;
}

export function GalleryAssetCard({ asset, onOpen }: GalleryAssetCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const hasThumbnail = Boolean(asset.thumbnailUrl) && !imgFailed;
  const displayName = asset.folderName ?? asset.relativePath.split("/").pop() ?? asset.assetId;

  return (
    <button
      type="button"
      onClick={() => onOpen(asset)}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`Open ${displayName}`}
    >
      {/* Thumbnail area — fixed aspect ratio */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-bg">
        {hasThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Drive URL; next/image remote loader is intentionally not used so rendering never contacts Google.
          <img
            src={asset.thumbnailUrl as string}
            alt={displayName}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-200 group-hover:scale-105 group-hover:transition-transform",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        ) : null}

        {/* Placeholder — shown when no thumbnail or while loading */}
        {!hasThumbnail || !imgLoaded ? (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center text-muted",
              hasThumbnail && !imgLoaded ? "opacity-100" : "opacity-100"
            )}
            aria-hidden="true"
          >
            <ImageOff className="h-8 w-8 opacity-40" />
          </div>
        ) : null}
      </div>

      {/* Card metadata */}
      <div className="flex flex-col gap-1 px-3 py-3">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-accent" title={displayName}>
          {displayName}
        </p>
        {asset.region ? (
          <p className="truncate text-xs text-muted" title={asset.region}>
            {asset.region}
          </p>
        ) : null}
        {asset.company ? (
          <p className="truncate text-xs text-muted" title={asset.company}>
            {asset.company}
          </p>
        ) : null}
      </div>
    </button>
  );
}
