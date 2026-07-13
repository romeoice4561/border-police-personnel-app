/**
 * MediaBadge — Media Design System (Phase 30.2).
 *
 * Overlaid badge for media thumbnails (portrait history, photo gallery, etc.).
 * Shows semantic information — "Current", "Official", "Verified" — without
 * cluttering the image.
 *
 * Always rendered with `pointer-events-none` so it never blocks clicks on the
 * underlying image/button.
 *
 * Usage
 * -----
 *   <div className="relative">
 *     <GalleryImage ... />
 *     <MediaBadge variant="current" position="top-left" />
 *     <MediaBadge variant="official" position="top-left" />
 *   </div>
 */
import { cn } from "@/lib/ui/cn";

export type MediaBadgeVariant =
  | "current"    // "Current" portrait / version
  | "official"   // "⭐ Official" portrait
  | "verified"   // "✓ Verified"
  | "custom";    // custom label via `label` prop

export type MediaBadgePosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface MediaBadgeProps {
  variant: MediaBadgeVariant;
  position?: MediaBadgePosition;
  /** Custom label — required when variant="custom", optional otherwise for overrides. */
  label?: string;
  className?: string;
}

const VARIANT_CLASS: Record<MediaBadgeVariant, string> = {
  current:  "bg-accent/90 text-accent-fg",
  official: "bg-warning-bg/90 text-warning",
  verified: "bg-good-bg/90 text-good",
  custom:   "bg-surface/90 text-foreground",
};

const VARIANT_LABEL: Record<MediaBadgeVariant, string> = {
  current:  "Current",
  official: "⭐ Official",
  verified: "✓",
  custom:   "",
};

const POSITION_CLASS: Record<MediaBadgePosition, string> = {
  "top-left":     "top-1.5 left-1.5",
  "top-right":    "top-1.5 right-1.5",
  "bottom-left":  "bottom-1.5 left-1.5",
  "bottom-right": "bottom-1.5 right-1.5",
};

/**
 * Overlaid informational badge for gallery/portrait thumbnails.
 * Rendered with pointer-events-none so it never blocks the image button.
 */
export function MediaBadge({
  variant,
  position = "top-left",
  label,
  className,
}: MediaBadgeProps) {
  const text = label ?? VARIANT_LABEL[variant];
  if (!text) return null;

  return (
    <span
      className={cn(
        "pointer-events-none absolute z-10 rounded-md px-1.5 py-0.5",
        "text-[10px] font-semibold leading-none backdrop-blur-sm",
        POSITION_CLASS[position],
        VARIANT_CLASS[variant],
        className
      )}
    >
      {text}
    </span>
  );
}
