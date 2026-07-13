/**
 * MediaPlaceholder — Media Design System (Phase 30.2).
 *
 * Consistent empty-state placeholder for every media type (Part 12).
 * Never shows a broken browser image icon — instead renders a meaningful
 * icon that communicates the expected media type.
 *
 * Variants
 * --------
 *   "portrait"   — User silhouette with optional initials (officer photos)
 *   "gallery"    — ImageOff icon (Drive photos, gallery tiles)
 *   "document"   — FileText icon (documents, certificates)
 *   "pdf"        — FileText icon + "PDF" label
 *   "file"       — File icon (generic, for unknown file types)
 *
 * Usage
 * -----
 *   <MediaPlaceholder type="gallery" className="h-full w-full" />
 *   <MediaPlaceholder type="portrait" initials="อข" size="lg" />
 */
import { File, FileText, ImageOff, User } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type MediaPlaceholderType = "portrait" | "gallery" | "document" | "pdf" | "file";

export interface MediaPlaceholderProps {
  /** The type of media this placeholder represents. */
  type: MediaPlaceholderType;
  /**
   * Optional initials shown inside a portrait placeholder.
   * Only used when type="portrait".
   */
  initials?: string;
  /** Extra classes for the container (typically "h-full w-full"). */
  className?: string;
  /** Icon size. Defaults to "md". */
  iconSize?: "sm" | "md" | "lg";
}

const ICON_SIZE: Record<NonNullable<MediaPlaceholderProps["iconSize"]>, string> = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

const LABEL_SIZE: Record<NonNullable<MediaPlaceholderProps["iconSize"]>, string> = {
  sm: "text-[9px]",
  md: "text-[11px]",
  lg: "text-sm",
};

/**
 * Placeholder shown when an image is missing or fails to load (Part 12).
 * Fully theme-aware — uses CSS variables for text/background.
 */
export function MediaPlaceholder({
  type,
  initials,
  className,
  iconSize = "md",
}: MediaPlaceholderProps) {
  const iconCls = cn(ICON_SIZE[iconSize], "opacity-40 text-muted");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 bg-neutral-bg text-muted",
        className
      )}
      aria-hidden="true"
    >
      {type === "portrait" ? (
        initials ? (
          <span
            className={cn("font-medium text-muted", LABEL_SIZE[iconSize])}
          >
            {initials}
          </span>
        ) : (
          <User className={iconCls} />
        )
      ) : type === "gallery" ? (
        <ImageOff className={iconCls} />
      ) : type === "pdf" ? (
        <>
          <FileText className={iconCls} />
          <span className={cn("font-semibold uppercase tracking-wide text-muted/70", LABEL_SIZE[iconSize])}>
            PDF
          </span>
        </>
      ) : type === "document" ? (
        <FileText className={iconCls} />
      ) : (
        <File className={iconCls} />
      )}
    </div>
  );
}
