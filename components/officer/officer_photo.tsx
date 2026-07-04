/**
 * OfficerPhoto (Phase 17B).
 *
 * The single reusable officer-avatar component. Renders the real Google Drive
 * thumbnail when a URL is present, and gracefully falls back to a neutral
 * placeholder (a person glyph over the officer's initials) when there is no
 * URL OR when the image fails to load — so there are never broken-image icons.
 *
 * Rendering uses the STORED URL only; it never fetches Drive metadata. Images
 * are lazy-loaded and given a fixed, reserved box (width = height = size) so
 * there is no layout shift while loading.
 *
 * Accessible: a real photo gets a descriptive alt; the placeholder is marked
 * aria-hidden with an accessible label on the container.
 */
"use client";

import { useState, type CSSProperties } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/ui/cn";

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
}

/** First letters of the first two name words (e.g. "อนิรุทธิ์ ขาว" → "อข"), for the placeholder. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "";
  return parts.map((p) => Array.from(p)[0] ?? "").join("");
}

export function OfficerPhoto({ thumbnailUrl, name, size = 40, className, iconSize }: OfficerPhotoProps) {
  // `failed` flips to true if the <img> errors, so a dead URL degrades to the
  // placeholder instead of a broken-image icon.
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const box: CSSProperties = { width: size, height: size, minWidth: size, minHeight: size };
  const showImage = Boolean(thumbnailUrl) && !failed;
  const glyphSize = iconSize ?? Math.round(size * 0.45);
  const label = initials(name);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-neutral-bg text-muted",
        className
      )}
      style={box}
      role="img"
      aria-label={showImage ? `Photo of ${name}` : `No photo available for ${name}`}
    >
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
    </span>
  );
}
