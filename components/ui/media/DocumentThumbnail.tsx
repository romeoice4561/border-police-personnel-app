/**
 * DocumentThumbnail — Media Design System (Phase 30.2).
 *
 * Reusable thumbnail for every Officer Document Vault card and history row.
 * Extracted from documents_section.tsx (Phase 30.1) into the shared Media
 * Design System so any screen can render a document thumbnail with a single
 * import, with no duplicated rendering logic.
 *
 * Object-fit behaviour:
 *   Documents always use object-contain, centered in a fixed-size canvas.
 *   This preserves the original aspect ratio, avoids stretching, and keeps
 *   thumbnails visually similar to Google Drive document previews.
 *
 * Cross-fade animation (Phase 30.1 ISSUE 7):
 *   Replacing the image (new fileUrl on the same slot) cross-fades between
 *   the old and new image instead of hard-remounting. The old image stays
 *   visible while the new one loads, then fades out as the new one fades in.
 *
 * Accessibility:
 *   - Meaningful `alt` text required (defaults to "Document").
 *   - `loading="lazy"` on every <img> so off-screen thumbnails aren't fetched.
 *   - PDF / non-image / error states show the FileText icon — never a broken
 *     browser icon (Part 12).
 *
 * Visual treatment:
 *   Uses a white document canvas with subtle border/shadow so white paper
 *   documents remain visible on dark or tinted cards.
 */
"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";
import { DOCUMENT_THUMBNAIL_RENDER_WIDTH } from "@/lib/ui/media_tokens";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives a Supabase image-render URL from a stored fileUrl.
 * Returns null for non-image MIME types (e.g. PDFs) or URLs that don't
 * follow the Supabase Storage `/object/public/` pattern.
 * The requested width gives a sharp source for high-DPI displays while the
 * render API preserves native aspect ratio.
 */
export function deriveDocumentThumbnailUrl(
  fileUrl: string | null | undefined,
  mimeType: string | null | undefined
): string | null {
  if (!fileUrl || !mimeType?.startsWith("image/")) return null;
  const OBJECT_SEGMENT = "/storage/v1/object/public/";
  if (!fileUrl.includes(OBJECT_SEGMENT)) return null;
  return (
    fileUrl.replace(OBJECT_SEGMENT, "/storage/v1/render/image/public/") +
    `?width=${DOCUMENT_THUMBNAIL_RENDER_WIDTH}`
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export interface DocumentThumbnailProps {
  /** Stored document fileUrl (Supabase Storage URL). */
  fileUrl: string | null | undefined;
  /** Document MIME type — determines image vs. PDF fallback. */
  mimeType: string | null | undefined;
  /** Document type code — determines object-fit strategy. */
  documentTypeCode: string;
  /**
   * Canvas size variant:
   * "md" — main card thumbnail → responsive fixed canvas:
   *        mobile 112×112, tablet 128×128, desktop 144×144
   * "sm" — history row thumbnail → 64×64 px
   */
  size?: "md" | "sm";
  /** Accessible alt text for the image. Defaults to "Document". */
  altText?: string;
}

/**
 * Thumbnail for a document card or history row.
 *
 * Renders a visually useful preview with correct fit, cross-fade on replace,
 * loading skeleton, and a PDF/error fallback icon.
 */
export function DocumentThumbnail({
  fileUrl,
  mimeType,
  size = "md",
  altText = "Document",
}: DocumentThumbnailProps) {
  const thumbnailUrl = deriveDocumentThumbnailUrl(fileUrl, mimeType);
  const isPdf = mimeType === "application/pdf";

  // Cross-fade state: `shown` is the currently-displayed (already-loaded)
  // image URL; `incoming` is a new URL loading in the background. Once it
  // finishes loading it fades in on top, then becomes `shown`.
  const [shown, setShown] = useState<string | null>(null);
  const [shownError, setShownError] = useState(false);
  // Initialised to thumbnailUrl (not null) so the very first render starts
  // loading the image immediately. The lastSeenUrl guard below only fires on
  // *changes*, so without this initialisation the image never loads on mount.
  const [incoming, setIncoming] = useState<string | null>(thumbnailUrl);
  const [incomingLoaded, setIncomingLoaded] = useState(false);
  // Tracks the last `thumbnailUrl` prop value seen — lets us detect a change
  // and adjust state DURING render (React's recommended "derive state from
  // props" pattern), avoiding a setState-in-effect cascade.
  const [lastSeenUrl, setLastSeenUrl] = useState(thumbnailUrl);
  if (thumbnailUrl !== lastSeenUrl) {
    setLastSeenUrl(thumbnailUrl);
    if (thumbnailUrl !== shown) {
      setIncoming(thumbnailUrl);
      setIncomingLoaded(false);
    }
  }

  const commitIncoming = useCallback(() => {
    setIncomingLoaded(true);
    // Give the fade-in transition time to play before dropping the old layer.
    window.setTimeout(() => {
      setShown(thumbnailUrl);
      setShownError(false);
      setIncoming(null);
    }, 200);
  }, [thumbnailUrl]);

  const sizeCls =
    size === "sm" ? "h-16 w-16 rounded-md" : "h-28 w-28 rounded-lg sm:h-32 sm:w-32 lg:h-36 lg:w-36";
  const iconCls = size === "sm" ? "h-6 w-6 text-muted" : "h-9 w-9 text-muted";
  const imgPadCls = size === "sm" ? "p-1.5" : "p-2";

  const showShown = Boolean(shown && !shownError);
  const showIncoming = Boolean(incoming);

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${sizeCls} bg-white shadow-sm ring-1 ring-border/60 transition-transform duration-200 hover:scale-[1.02]`}
    >
      {!showShown && !showIncoming ? (
        /* PDF / non-image / error fallback — never a broken browser icon */
        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
          <FileText className={iconCls} aria-hidden="true" />
          {size === "md" && isPdf && fileUrl ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/70">
              PDF
            </span>
          ) : null}
        </div>
      ) : null}

      {showShown ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage render URL; next/image not applicable
        <img
          src={shown!}
          alt={altText}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-contain object-center ${imgPadCls} opacity-100 transition-opacity duration-200`}
          onError={() => setShownError(true)}
        />
      ) : null}

      {showIncoming ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage render URL; next/image not applicable
        <img
          src={incoming!}
          alt={altText}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-contain object-center ${imgPadCls} transition-opacity duration-200 ${incomingLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={commitIncoming}
          onError={() => setIncoming(null)}
        />
      ) : null}

      {/* Loading skeleton only for the very first image of this slot */}
      {!showShown && showIncoming && !incomingLoaded ? (
        <div
          className="absolute inset-0 animate-pulse bg-border/40"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
