/**
 * DocumentThumbnail — Media Design System (Phase 30.2).
 *
 * Reusable thumbnail for every Officer Document Vault card and history row.
 * Extracted from documents_section.tsx (Phase 30.1) into the shared Media
 * Design System so any screen can render a document thumbnail with a single
 * import, with no duplicated rendering logic.
 *
 * Object-fit behaviour:
 *   CARD_SHAPED_TYPES (ID cards, passports, driver licenses, officer cards)
 *     → object-cover — fills the frame, face/text stays large and legible,
 *       a small edge-crop is acceptable.
 *   All other types (GP7, certificates, appointment orders — typically A4)
 *     → object-contain on a taller canvas — full page always visible, no
 *       information cropped.
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
 * Dark mode (Part 14):
 *   Uses `bg-neutral-bg/80` (theme-aware) and `ring-border/30` so the
 *   thumbnail container automatically adapts to light/dark.
 */
"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";
import {
  DOCUMENT_CARD_TYPES,
  DOCUMENT_THUMBNAIL_RENDER_WIDTH,
} from "@/lib/ui/media_tokens";

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

type ThumbnailFit = "cover" | "contain";

/**
 * Determines the object-fit strategy for a given document type code:
 * - Card-shaped identity docs → "cover" (fills frame, face legible).
 * - A4-shaped forms / certificates → "contain" (whole page visible, no crop).
 */
export function getThumbnailFit(documentTypeCode: string): ThumbnailFit {
  return DOCUMENT_CARD_TYPES.has(documentTypeCode) ? "cover" : "contain";
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
   * "md" — main card thumbnail:
   *        card-shaped types → 144×96 px landscape (object-cover)
   *        A4-shaped types   → 112×144 px portrait  (object-contain)
   * "sm" — history row thumbnail → 56×56 px
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
  documentTypeCode,
  size = "md",
  altText = "Document",
}: DocumentThumbnailProps) {
  const thumbnailUrl = deriveDocumentThumbnailUrl(fileUrl, mimeType);
  const isPdf = mimeType === "application/pdf";
  const fit = getThumbnailFit(documentTypeCode);

  // Cross-fade state: `shown` is the currently-displayed (already-loaded)
  // image URL; `incoming` is a new URL loading in the background. Once it
  // finishes loading it fades in on top, then becomes `shown`.
  const [shown, setShown] = useState<string | null>(null);
  const [shownError, setShownError] = useState(false);
  const [incoming, setIncoming] = useState<string | null>(null);
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
    size === "sm"
      ? "h-14 w-14 rounded"
      : fit === "cover"
        ? "h-24 w-36 rounded-md"
        : "h-36 w-28 rounded-md";
  const iconCls = size === "sm" ? "h-5 w-5 text-muted" : "h-8 w-8 text-muted";
  // object-cover fills the frame (no padding); object-contain gets breathing
  // room so the page never touches the border.
  const imgFitCls = fit === "cover" ? "object-cover" : "object-contain";
  const imgPadCls = fit === "cover" ? "" : size === "sm" ? "p-1" : "p-2";

  const showShown = Boolean(shown && !shownError);
  const showIncoming = Boolean(incoming);

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${sizeCls} bg-neutral-bg/80 shadow-sm ring-1 ring-border/30`}
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
          className={`absolute inset-0 h-full w-full ${imgFitCls} ${imgPadCls} opacity-100 transition-opacity duration-200`}
          onError={() => setShownError(true)}
        />
      ) : null}

      {showIncoming ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage render URL; next/image not applicable
        <img
          src={incoming!}
          alt={altText}
          loading="lazy"
          className={`absolute inset-0 h-full w-full ${imgFitCls} ${imgPadCls} transition-opacity duration-200 ${incomingLoaded ? "opacity-100" : "opacity-0"}`}
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
