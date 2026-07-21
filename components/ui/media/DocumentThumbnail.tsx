/**
 * DocumentThumbnail — Media Design System (Phase 30.2 / 49A.3 fit correction).
 *
 * Reusable thumbnail for every Officer Document Vault card and history row.
 *
 * Object-fit behaviour:
 *   ALWAYS object-contain so an official document is NEVER cropped.
 *   Frame orientation adapts to the real image (naturalWidth/Height) after
 *   load — portrait phone scans of passport/ID get a portrait frame so the
 *   document fills most of the preview instead of becoming a thin strip in a
 *   forced landscape canvas.
 *
 * Image source:
 *   Prefers the persisted full file URL (see resolveDocumentImageSrc). Never
 *   uses a Drive webView HTML page as <img> src. Never fabricates Drive URLs
 *   from synthetic upload IDs.
 *
 * Visual treatment:
 *   One neutral preview canvas + minimal safety inset. Optional blurred
 *   backdrop of the same image fills letterbox gaps without cropping the
 *   foreground document. Official portraits never use this component.
 */
"use client";

import { useCallback, useState } from "react";
import { FileText } from "lucide-react";
import {
  documentCanvasForOrientation,
  documentThumbnailContentInsetClass,
} from "@/lib/ui/media_tokens";
import {
  deriveDocumentThumbnailUrl,
  fallbackOrientationForDocumentType,
  orientationFromNaturalSize,
  resolveDocumentImageSrc,
  type DocumentImageOrientation,
} from "@/lib/ui/document_thumbnail_source";

export { deriveDocumentThumbnailUrl };

// ── Component ────────────────────────────────────────────────────────────────

export interface DocumentThumbnailProps {
  /** Stored document fileUrl (Supabase Storage / persisted preview URL). */
  fileUrl: string | null | undefined;
  /** Document MIME type — determines image vs. PDF fallback. */
  mimeType: string | null | undefined;
  /** Document type code — fallback orientation before natural size is known. */
  documentTypeCode: string;
  /**
   * Canvas size variant:
   * "md" — main card thumbnail (adaptive orientation frame)
   * "sm" — history row thumbnail: 56×56
   */
  size?: "md" | "sm";
  /** Optional stored thumbnail — only used when no full image URL exists. */
  thumbnailUrl?: string | null | undefined;
  /** Genuine Drive file id — never synthetic `upload:…` values. */
  driveFileId?: string | null | undefined;
  /** Drive HTML page — never used as image src. */
  webViewUrl?: string | null | undefined;
  /** Accessible alt text for the image. Defaults to "Document". */
  altText?: string;
  /**
   * Full, already-localized accessible label for the clickable Preview
   * shortcut (e.g. "ดูตัวอย่างเอกสาร บัตรประจำตัวประชาชน") — required
   * whenever `onClick` is supplied.
   */
  previewAriaLabel?: string;
  /** Optional shortcut action, typically Preview. */
  onClick?: () => void;
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
  thumbnailUrl: storedThumbnailUrl,
  driveFileId,
  webViewUrl,
  altText = "Document",
  previewAriaLabel,
  onClick,
}: DocumentThumbnailProps) {
  const resolved = resolveDocumentImageSrc({
    fileUrl,
    mimeType,
    thumbnailUrl: storedThumbnailUrl,
    driveFileId,
    webViewUrl,
  });
  const imageUrl = resolved.imageUrl;
  const isPdf = mimeType === "application/pdf";

  const [orientation, setOrientation] = useState<DocumentImageOrientation>(() =>
    fallbackOrientationForDocumentType(documentTypeCode)
  );

  // Cross-fade state: `shown` is the currently-displayed (already-loaded)
  // image URL; `incoming` is a new URL loading in the background.
  const [shown, setShown] = useState<string | null>(null);
  const [shownError, setShownError] = useState(false);
  const [incoming, setIncoming] = useState<string | null>(imageUrl);
  const [incomingLoaded, setIncomingLoaded] = useState(false);
  const [lastSeenUrl, setLastSeenUrl] = useState(imageUrl);
  if (imageUrl !== lastSeenUrl) {
    setLastSeenUrl(imageUrl);
    if (imageUrl !== shown) {
      setIncoming(imageUrl);
      setIncomingLoaded(false);
    }
  }

  const applyNaturalOrientation = useCallback((naturalWidth: number, naturalHeight: number) => {
    if (size === "sm") return;
    setOrientation(orientationFromNaturalSize(naturalWidth, naturalHeight));
  }, [size]);

  const commitIncoming = useCallback(
    (naturalWidth?: number, naturalHeight?: number) => {
      if (typeof naturalWidth === "number" && typeof naturalHeight === "number") {
        applyNaturalOrientation(naturalWidth, naturalHeight);
      }
      setIncomingLoaded(true);
      window.setTimeout(() => {
        setShown(imageUrl);
        setShownError(false);
        setIncoming(null);
      }, 200);
    },
    [imageUrl, applyNaturalOrientation]
  );

  const canvas = documentCanvasForOrientation(orientation, size);
  const radiusCls = size === "sm" ? "rounded-md" : "rounded-lg";
  const sizeCls = `${canvas.frame} ${radiusCls}`;
  const iconCls = size === "sm" ? "h-6 w-6 text-muted" : "h-8 w-8 text-muted";
  const contentInsetCls = documentThumbnailContentInsetClass(size);
  const contentScale = size === "sm" ? "0.92" : "0.96";
  const fitCls = "object-contain";
  const activeSrc = shown && !shownError ? shown : incoming;

  const showShown = Boolean(shown && !shownError);
  const showIncoming = Boolean(incoming);

  const content = (
    <>
      {/* Blurred same-image fill — decorative only; foreground stays object-contain. */}
      {size === "md" && activeSrc && !shownError ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative fill; next/image not applicable
        <img
          src={activeSrc}
          alt=""
          aria-hidden="true"
          data-role="document-thumb-backdrop"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md"
        />
      ) : null}

      {!showShown && !showIncoming ? (
        <div className={`absolute ${contentInsetCls} z-[1] flex flex-col items-center justify-center gap-1`}>
          <FileText className={iconCls} aria-hidden="true" />
          {size === "md" && isPdf && fileUrl ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/70">
              PDF
            </span>
          ) : null}
        </div>
      ) : null}

      {showShown ? (
        <div
          className={`absolute ${contentInsetCls} z-[1]`}
          data-content-scale={contentScale}
          data-preview-canvas="primary"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- storage URL; next/image not applicable */}
          <img
            src={shown!}
            alt={altText}
            loading="lazy"
            data-fit="contain"
            data-orientation={orientation}
            className={`h-full w-full ${fitCls} object-center opacity-100 transition-opacity duration-200`}
            onLoad={(e) => applyNaturalOrientation(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
            onError={() => setShownError(true)}
          />
        </div>
      ) : null}

      {showIncoming ? (
        <div
          className={`absolute ${contentInsetCls} z-[1]`}
          data-content-scale={contentScale}
          data-preview-canvas="primary"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- storage URL; next/image not applicable */}
          <img
            src={incoming!}
            alt={altText}
            loading="lazy"
            data-fit="contain"
            data-orientation={orientation}
            className={`h-full w-full ${fitCls} object-center transition-opacity duration-200 ${incomingLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={(e) =>
              commitIncoming(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
            }
            onError={() => {
              // Fall back to stored secondary URL once if primary fails.
              if (resolved.fallbackUrl && incoming !== resolved.fallbackUrl) {
                setIncoming(resolved.fallbackUrl);
                setIncomingLoaded(false);
                return;
              }
              setIncoming(null);
            }}
          />
        </div>
      ) : null}

      {!showShown && showIncoming && !incomingLoaded ? (
        <div className="absolute inset-0 z-[1] animate-pulse bg-border/40" aria-hidden="true" />
      ) : null}
    </>
  );

  // Single preview canvas — muted surface so white scans stay readable in dark mode.
  const baseClassName = `relative shrink-0 overflow-hidden ${sizeCls} bg-neutral-bg shadow-sm ring-1 ring-border/60`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-orientation={orientation}
        data-source-kind={resolved.sourceKind}
        className={`${baseClassName} cursor-pointer transition-all duration-300 ease-out hover:scale-105 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
        aria-label={previewAriaLabel ?? `Preview ${altText}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={baseClassName} data-orientation={orientation} data-source-kind={resolved.sourceKind}>
      {content}
    </div>
  );
}
