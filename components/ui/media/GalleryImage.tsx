/**
 * GalleryImage — Media Design System (Phase 30.2).
 *
 * Reusable image tile for any gallery grid (Photo Gallery, Gallery Browser,
 * etc.). Implements the canonical gallery presentation:
 *
 *   • Rounded rectangle (rounded-xl) — never a circle (Part 5).
 *   • object-cover to fill the frame, maintaining composition.
 *   • Lazy loading + fade-in on load (no layout shift, no FOIT).
 *   • Fallback to `fallbackSrc` on error (Drive high-res → stored thumbnail).
 *   • Placeholder icon when no image is available (Part 12).
 *   • Optional hover scale-up (driven by Tailwind `group` on the parent).
 *   • Dark mode: `bg-neutral-bg` container adapts automatically (Part 14).
 *   • Accessible alt text required (Part 13).
 *
 * Usage
 * -----
 *   // Inside a group-hover container:
 *   <div className="group relative rounded-xl overflow-hidden aspect-[4/3]">
 *     <GalleryImage src={asset.thumbnailUrl} alt={displayName} hoverScale />
 *   </div>
 *
 *   // Fixed aspect via the aspectRatio prop:
 *   <GalleryImage src={url} alt={name} aspectRatio="4/3" />
 */
"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export interface GalleryImageProps {
  /** Primary image URL. */
  src: string | null | undefined;
  /** Alt text — required for accessibility (Part 13). */
  alt: string;
  /**
   * Optional lower-resolution fallback URL tried once if `src` fails to load.
   * Useful for Drive high-res → stored thumbnail fallback.
   */
  fallbackSrc?: string | null;
  /**
   * CSS aspect-ratio shorthand (e.g. "4/3", "1/1", "3/4") applied to the
   * container. When omitted the component fills its parent's dimensions.
   */
  aspectRatio?: string;
  /** When true, adds `group-hover:scale-105` — requires a `group` class on the parent. */
  hoverScale?: boolean;
  /** Extra CSS classes applied to the outer container. */
  className?: string;
  /** `referrerpolicy` for the underlying <img>. Defaults to "no-referrer". */
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>["referrerPolicy"];
  /** Called when the image loads successfully. */
  onLoad?: () => void;
  /** Called when both src and fallbackSrc fail to load. */
  onError?: () => void;
}

/**
 * Gallery image tile with lazy loading, fade-in, error fallback, and a
 * consistent placeholder icon. Uses the canonical gallery rounded-rectangle
 * and never crops into a circle.
 */
export function GalleryImage({
  src,
  alt,
  fallbackSrc,
  aspectRatio,
  hoverScale = false,
  className,
  referrerPolicy = "no-referrer",
  onLoad,
  onError,
}: GalleryImageProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const hasSrc = Boolean(src) && !imgFailed;

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (fallbackSrc && e.currentTarget.src !== fallbackSrc) {
      e.currentTarget.onerror = null;
      e.currentTarget.src = fallbackSrc;
      return;
    }
    setImgFailed(true);
    onError?.();
  };

  const handleLoad = () => {
    setImgLoaded(true);
    onLoad?.();
  };

  return (
    <div
      className={cn(
        // Defensive containment (bug-fix pass): max-w-full/max-h-full here are
        // a SAFETY NET, not the primary sizing mechanism — callers are still
        // expected to pass an explicit bounded className (aspect-square,
        // h-full w-full, etc.). This just guarantees a caller that forgets to
        // bound this component can never have it expand past its own parent,
        // regardless of the source image's intrinsic pixel dimensions.
        "relative max-h-full max-w-full overflow-hidden bg-neutral-bg",
        className
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {hasSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Drive/Storage URL; next/image remote loader is intentionally not used
        <img
          src={src as string}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy={referrerPolicy}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            // object-cover fills the bounded container above without ever
            // rendering at the image's intrinsic pixel size — the container's
            // own dimensions (from aspectRatio/className) are always what's
            // laid out, never the <img>'s natural width/height.
            "h-full max-h-full w-full max-w-full object-cover transition-all duration-300",
            hoverScale && "group-hover:scale-105",
            imgLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}

      {/* Placeholder: shown while loading or when no image is available (Part 12) */}
      {(!hasSrc || !imgLoaded) ? (
        <div
          className="absolute inset-0 flex items-center justify-center text-muted"
          aria-hidden="true"
        >
          <ImageOff className="h-8 w-8 opacity-30" />
        </div>
      ) : null}
    </div>
  );
}
