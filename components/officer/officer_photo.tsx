/**
 * OfficerPhoto (Phase 17B; Phase 18A viewer).
 *
 * The single reusable officer-avatar component. Renders the real Google Drive
 * thumbnail when a URL is present, and gracefully falls back to a neutral
 * placeholder (a person glyph over the officer's initials) when there is no
 * URL OR when the image fails to load — so there are never broken-image icons.
 *
 * Phase 18A: when a Drive photo is present, the thumbnail becomes a button that
 * opens the full-resolution PhotoModal viewer (zoom/pan/pinch). The modal — and
 * therefore the full-resolution image request — is mounted lazily, only after a
 * click, so nothing extra is fetched on the list/detail pages. Rendering uses
 * the STORED/derived URL only; it never fetches Drive metadata.
 *
 * Accessible: a real photo gets a descriptive alt; the placeholder is marked
 * aria-hidden with an accessible label on the container.
 */
"use client";

import { useState, type CSSProperties } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { PhotoModal } from "@/components/officer/photo_modal";

export interface OfficerPhotoProps {
  /** Stored Drive thumbnail URL, or null/undefined when none was captured. */
  thumbnailUrl?: string | null;
  /** Officer display name — used for the alt text and initials fallback. */
  name: string;
  /** Square edge length in pixels (reserved to avoid layout shift). Default 40. */
  size?: number;
  className?: string;
  /** Icon size override; defaults to ~45% of `size`. */
  iconSize?: number;
  /** Phase 18A: Drive file id — enables deriving the full-resolution viewer image. */
  driveFileId?: string | null;
  /** Phase 18A: Drive "view" page URL — offered as an "Open in Drive" link in the viewer. */
  webViewUrl?: string | null;
  /**
   * Phase 18A: whether clicking the photo opens the full-resolution viewer.
   * Defaults to true when there is any image to show; set false for purely
   * decorative avatars (e.g. inside a link that should navigate instead).
   */
  enableViewer?: boolean;
}

/** First letters of the first two name words (e.g. "อนิรุทธิ์ ขาว" → "อข"), for the placeholder. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "";
  return parts.map((p) => Array.from(p)[0] ?? "").join("");
}

export function OfficerPhoto({
  thumbnailUrl,
  name,
  size = 40,
  className,
  iconSize,
  driveFileId,
  webViewUrl,
  enableViewer,
}: OfficerPhotoProps) {
  // `failed` flips to true if the <img> errors, so a dead URL degrades to the
  // placeholder instead of a broken-image icon.
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const box: CSSProperties = { width: size, height: size, minWidth: size, minHeight: size };
  const showImage = Boolean(thumbnailUrl) && !failed;
  const glyphSize = iconSize ?? Math.round(size * 0.45);
  const label = initials(name);

  // A viewer is available when there is any image identity to open. Default on,
  // overridable via `enableViewer`.
  const hasPhotoIdentity = Boolean(driveFileId || thumbnailUrl);
  const viewerEnabled = (enableViewer ?? true) && hasPhotoIdentity && !failed;

  const inner = (
    <>
      {/* Placeholder layer — always rendered underneath, so the reserved box is
          never empty (no layout shift) and it shows through until the image
          paints or if the image fails. */}
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        {label ? (
          <span className="font-medium" style={{ fontSize: Math.max(10, Math.round(size * 0.32)) }}>
            {label}
          </span>
        ) : (
          <User style={{ width: glyphSize, height: glyphSize }} />
        )}
      </span>

      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Drive URL; next/image remote loader is intentionally not used so rendering never contacts Google.
        <img
          src={thumbnailUrl as string}
          alt={`Photo of ${name}`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}
    </>
  );

  const sharedClass = cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-neutral-bg text-muted",
    className
  );

  if (viewerEnabled) {
    return (
      <>
        <button
          type="button"
          className={cn(sharedClass, "cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent")}
          style={box}
          aria-label={`View full-resolution photo of ${name}`}
          onClick={(e) => {
            // Stop the click from triggering a parent <Link> (table/card/review).
            e.preventDefault();
            e.stopPropagation();
            setViewerOpen(true);
          }}
        >
          {inner}
        </button>
        <PhotoModal
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          name={name}
          photo={{ driveFileId, thumbnailUrl, webViewUrl }}
        />
      </>
    );
  }

  return (
    <span
      className={sharedClass}
      style={box}
      role="img"
      aria-label={showImage ? `Photo of ${name}` : `No photo available for ${name}`}
    >
      {inner}
    </span>
  );
}
