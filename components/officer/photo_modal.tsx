/**
 * PhotoModal (Phase 18A; gallery navigation/download/open-original Phase 26A).
 *
 * The fullscreen overlay chrome around PhotoViewer: a dark backdrop, a top-
 * right close button, ESC-to-close, click-outside-to-close, a focus trap, and
 * ARIA dialog semantics. It owns NO viewer/zoom/rotate logic (that all lives
 * in PhotoViewer) — it only presents the viewer and handles open/close/
 * navigate. Phase 26A adds optional gallery navigation (Previous/Next, with
 * ←/→ keyboard support) and Download/Open Original actions in the top bar —
 * all additive and optional, so every existing single-photo caller
 * (PortraitManager's "Preview Full Size") is unaffected.
 *
 * The viewer (and therefore the image request) is mounted only while the modal
 * is open, so nothing is fetched until the user opens it. Rendered through a
 * portal to document.body so the overlay escapes any parent stacking/overflow.
 */
"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";
import { downloadFile, toDownloadName } from "@/lib/ui/download_file";
import { PhotoViewer } from "@/components/officer/photo_viewer";
import { resolveViewerSource, type OfficerPhotoInput } from "@/lib/ui/officer_photo_source";

export interface PhotoModalProps {
  open: boolean;
  onClose: () => void;
  photo: OfficerPhotoInput;
  name: string;
  /** Optional title shown top-left (defaults to the officer name). */
  title?: ReactNode;
  /**
   * Optional same-origin download URL (e.g. Gallery `/api/gallery/assets/…/download`).
   * When set, Download uses this path instead of the cross-origin viewer image
   * URL — required for Drive-hosted Gallery assets where CORS blocks fetch→blob
   * and browsers ignore `<a download>` on cross-origin hrefs.
   */
  downloadUrl?: string | null;
  /** Optional explicit download filename (with extension). Defaults from `name` + .jpg. */
  downloadFilename?: string | null;
  /** Phase 26A: gallery navigation — shown only when both are supplied. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Disables the Previous/Next buttons at the ends of the gallery, even when the handlers are supplied. */
  hasPrev?: boolean;
  hasNext?: boolean;
}

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function PhotoModal({
  open,
  onClose,
  photo,
  name,
  title,
  downloadUrl,
  downloadFilename,
  onPrev,
  onNext,
  hasPrev = true,
  hasNext = true,
}: PhotoModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && onPrev && hasPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === "ArrowRight" && onNext && hasNext) {
        e.preventDefault();
        onNext();
        return;
      }
      // Focus trap: keep Tab within the dialog.
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose, onPrev, onNext, hasPrev, hasNext]
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);

    // Lock body scroll while open (avoids background scroll + layout shift from
    // the scrollbar by compensating with padding).
    const { body } = document;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollBarWidth > 0) body.style.paddingRight = `${scrollBarWidth}px`;

    // Move focus into the dialog (the close button).
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open || typeof document === "undefined") return null;

  const source = resolveViewerSource(photo);
  const showNav = Boolean(onPrev || onNext);
  const resolvedDownloadUrl = (downloadUrl ?? "").trim() || source.imageUrl;
  const resolvedDownloadName =
    (downloadFilename ?? "").trim() || toDownloadName(name, { ext: "jpg" });

  function download() {
    if (!resolvedDownloadUrl) return;
    // Prefer a same-origin proxy URL when supplied (Gallery). Otherwise fetch
    // the viewer image URL into a blob so the filename is preserved.
    void downloadFile(resolvedDownloadUrl, resolvedDownloadName);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo of ${name}`}
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
      // Click on the backdrop (not the image/toolbar) closes.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar: title + actions + close */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="truncate text-sm font-medium">{title ?? name}</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={download}
            disabled={!resolvedDownloadUrl}
            aria-label="Download image"
            title="Download"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition-colors hover:bg-white/15 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
          {source.webViewUrl ? (
            <a
              href={source.webViewUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open original"
              title="Open Original"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="Close photo viewer"
            title="Close (Esc)"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Viewer surface — mounted only while open, so the image loads lazily.
          Keyed by the image identity so a different photo remounts the viewer
          (resetting its zoom/pan/rotate state) without any in-render reset logic. */}
      <div className="relative min-h-0 flex-1">
        <PhotoViewer
          key={photo.driveFileId ?? photo.thumbnailUrl ?? name}
          photo={photo}
          name={name}
        />

        {showNav ? (
          <>
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev || !hasPrev}
              aria-label="Previous photo"
              title="Previous (←)"
              className="absolute left-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition-colors hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext || !hasNext}
              aria-label="Next photo"
              title="Next (→)"
              className="absolute right-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition-colors hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
