/**
 * PhotoModal (Phase 18A).
 *
 * The fullscreen overlay chrome around PhotoViewer: a dark backdrop, a top-
 * right close button, ESC-to-close, click-outside-to-close, a focus trap, and
 * ARIA dialog semantics. It owns NO viewer/zoom logic (that all lives in
 * PhotoViewer) — it only presents the viewer and handles open/close.
 *
 * The viewer (and therefore the image request) is mounted only while the modal
 * is open, so nothing is fetched until the user opens it. Rendered through a
 * portal to document.body so the overlay escapes any parent stacking/overflow.
 */
"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PhotoViewer } from "@/components/officer/photo_viewer";
import type { OfficerPhotoInput } from "@/lib/ui/officer_photo_source";

export interface PhotoModalProps {
  open: boolean;
  onClose: () => void;
  photo: OfficerPhotoInput;
  name: string;
  /** Optional title shown top-left (defaults to the officer name). */
  title?: ReactNode;
}

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function PhotoModal({ open, onClose, photo, name, title }: PhotoModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
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
    [onClose]
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
      {/* Top bar: title + close */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="truncate text-sm font-medium">{title ?? name}</p>
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

      {/* Viewer surface — mounted only while open, so the image loads lazily.
          Keyed by the image identity so a different photo remounts the viewer
          (resetting its zoom/pan state) without any in-render reset logic. */}
      <div className="min-h-0 flex-1">
        <PhotoViewer
          key={photo.driveFileId ?? photo.thumbnailUrl ?? name}
          photo={photo}
          name={name}
        />
      </div>
    </div>,
    document.body
  );
}
