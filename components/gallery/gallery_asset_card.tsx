/**
 * GalleryAssetCard (Phase 19D; badge polish Phase 19F).
 *
 * One card in the Gallery grid. Shows:
 *   - Thumbnail (stored Drive URL — no API call, lazy loaded)
 *   - Folder / display name as the card title
 *   - Small colored badges for region, company, and battalion
 *
 * Clicking the card calls onOpen(asset) — the parent mounts the
 * PhotoModal (one modal at GalleryBrowser level, not per card).
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
  const displayName  =
    asset.folderName ??
    asset.relativePath.split("/").pop() ??
    asset.assetId;

  return (
    <button
      type="button"
      onClick={() => onOpen(asset)}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`เปิดรูป ${displayName}`}
    >
      {/* Thumbnail — fixed 4:3 aspect */}
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
              "h-full w-full object-cover transition-all duration-300",
              "group-hover:scale-105",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        ) : null}

        {/* Placeholder shown until the image loads or when none is available */}
        {(!hasThumbnail || !imgLoaded) ? (
          <div
            className="absolute inset-0 flex items-center justify-center text-muted"
            aria-hidden="true"
          >
            <ImageOff className="h-8 w-8 opacity-30" />
          </div>
        ) : null}
      </div>

      {/* Card metadata */}
      <div className="flex flex-col gap-2 px-3 py-3">
        {/* Folder / display name */}
        <p
          className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-accent"
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
  );
}
