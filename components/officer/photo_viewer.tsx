/**
 * PhotoViewer (Phase 18A).
 *
 * The reusable full-resolution image surface: renders one image with mouse-
 * wheel zoom, double-click zoom, drag-to-pan, pinch-to-zoom (touch), fit-to-
 * screen, reset, a bottom zoom toolbar, a loading indicator, and a broken-image
 * fallback. It contains ALL the viewer/zoom logic — the modal (photo_modal.tsx)
 * only supplies the overlay chrome, so there is no duplicated viewer logic.
 *
 * Rendering uses the STORED/derived image URL only (lib/ui/officer_photo_source);
 * it never calls a Google API or re-downloads. Handlers are memoized to avoid
 * unnecessary re-renders; the image is not fetched until this component mounts
 * (the modal mounts it lazily on open).
 */
"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { ImageOff, Loader2, Minus, Plus, Maximize2, RotateCcw } from "lucide-react";
import { resolveViewerSource, type OfficerPhotoInput } from "@/lib/ui/officer_photo_source";
import { cn } from "@/lib/ui/cn";

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const DOUBLE_CLICK_SCALE = 2.5;
const WHEEL_STEP = 0.0015;
const BUTTON_STEP = 0.5;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Euclidean distance between two touch points, for pinch. */
function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export interface PhotoViewerProps {
  photo: OfficerPhotoInput;
  /** Officer name — used for alt text and the placeholder. */
  name: string;
  className?: string;
}

export function PhotoViewer({ photo, name, className }: PhotoViewerProps) {
  const source = useMemo(() => resolveViewerSource(photo), [photo]);

  const [imgSrc, setImgSrc] = useState<string | null>(source.imageUrl);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(source.imageUrl ? "loading" : "error");
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  // Render-safe flag: transitions are suppressed while a pointer gesture is
  // active (so drag/pinch feel direct), re-enabled between gestures for smooth
  // button/wheel zoom. Kept as state (not a ref) so it is safe to read in JSX.
  const [interacting, setInteracting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  // Pointer/drag state kept in refs so panning doesn't re-render per move.
  const dragging = useRef(false);
  const lastPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePointers = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const isZoomed = transform.scale > MIN_SCALE + 0.001;

  const reset = useCallback(() => setTransform(IDENTITY), []);

  // NOTE: this component's state is initialized from the resolved source and is
  // reset by REMOUNTING (PhotoModal keys PhotoViewer by the image identity), so
  // there is no in-render state adjustment or reset-effect here.

  const handleImageError = useCallback(() => {
    // Try the lower-res fallback once before giving up.
    if (source.fallbackUrl && imgSrc !== source.fallbackUrl) {
      setImgSrc(source.fallbackUrl);
      setStatus("loading");
      return;
    }
    setStatus("error");
  }, [source.fallbackUrl, imgSrc]);

  const zoomBy = useCallback((delta: number, origin?: { x: number; y: number }) => {
    setTransform((prev) => {
      const nextScale = clamp(prev.scale + delta, MIN_SCALE, MAX_SCALE);
      if (nextScale === prev.scale) return prev;
      if (nextScale === MIN_SCALE) return IDENTITY;

      // Zoom toward the origin point (cursor) so it stays under the pointer.
      const rect = containerRef.current?.getBoundingClientRect();
      if (origin && rect) {
        const cx = origin.x - rect.left - rect.width / 2;
        const cy = origin.y - rect.top - rect.height / 2;
        const ratio = nextScale / prev.scale;
        return {
          scale: nextScale,
          x: cx - (cx - prev.x) * ratio,
          y: cy - (cy - prev.y) * ratio,
        };
      }
      return { ...prev, scale: nextScale };
    });
  }, []);

  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (status !== "loaded") return;
      e.preventDefault();
      zoomBy(-e.deltaY * WHEEL_STEP * Math.max(1, transform.scale), { x: e.clientX, y: e.clientY });
    },
    [zoomBy, status, transform.scale]
  );

  const onDoubleClick = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (status !== "loaded") return;
      if (isZoomed) {
        reset();
      } else {
        setTransform((prev) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return { ...prev, scale: DOUBLE_CLICK_SCALE };
          const cx = e.clientX - rect.left - rect.width / 2;
          const cy = e.clientY - rect.top - rect.height / 2;
          return { scale: DOUBLE_CLICK_SCALE, x: cx * (1 - DOUBLE_CLICK_SCALE), y: cy * (1 - DOUBLE_CLICK_SCALE) };
        });
      }
    },
    [isZoomed, reset, status]
  );

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    setInteracting(true);

    if (activePointers.current.size === 2) {
      const [a, b] = Array.from(activePointers.current.values());
      pinchStart.current = { distance: touchDistance(a, b), scale: 0 };
      setTransform((prev) => {
        pinchStart.current = { distance: touchDistance(a, b), scale: prev.scale };
        return prev;
      });
      dragging.current = false;
    } else {
      dragging.current = true;
      lastPoint.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Pinch zoom (two pointers).
    if (activePointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(activePointers.current.values());
      const dist = touchDistance(a, b);
      const start = pinchStart.current;
      if (start.distance > 0) {
        const nextScale = clamp((start.scale || 1) * (dist / start.distance), MIN_SCALE, MAX_SCALE);
        setTransform((prev) => (nextScale === MIN_SCALE ? IDENTITY : { ...prev, scale: nextScale }));
      }
      return;
    }

    // Drag pan (one pointer, only meaningful when zoomed).
    if (dragging.current) {
      const dx = e.clientX - lastPoint.current.x;
      const dy = e.clientY - lastPoint.current.y;
      lastPoint.current = { x: e.clientX, y: e.clientY };
      setTransform((prev) => (prev.scale <= MIN_SCALE ? prev : { ...prev, x: prev.x + dx, y: prev.y + dy }));
    }
  }, []);

  const endPointer = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchStart.current = null;
    if (activePointers.current.size === 0) {
      dragging.current = false;
      setInteracting(false);
    }
  }, []);

  const canDrag = isZoomed && status === "loaded";

  if (status === "error" || !source.hasImage) {
    return (
      <div
        className={cn("flex h-full w-full flex-col items-center justify-center gap-3 text-white/70", className)}
        role="img"
        aria-label={`No image available for ${name}`}
      >
        <ImageOff className="h-12 w-12" aria-hidden="true" />
        <p className="text-sm">Image unavailable</p>
        {source.webViewUrl ? (
          <a
            href={source.webViewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-white underline underline-offset-2 hover:opacity-80"
          >
            Open in Google Drive
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("relative flex h-full w-full flex-col", className)}>
      {/* Zoomable surface */}
      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 touch-none select-none overflow-hidden",
          canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        )}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      >
        {status === "loading" ? (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <Loader2 className="h-10 w-10 animate-spin text-white/80" />
          </div>
        ) : null}

        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- external Drive URL; next/image remote loader is intentionally not used so rendering never contacts Google. */}
          <img
            src={imgSrc ?? undefined}
            alt={`Full-resolution photo of ${name}`}
            draggable={false}
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setStatus("loaded")}
            onError={handleImageError}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transition: interacting ? "none" : "transform 150ms ease-out",
            }}
            className={cn(
              "max-h-full max-w-full object-contain will-change-transform",
              status === "loaded" ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      </div>

      {/* Bottom zoom toolbar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4">
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2 py-1 text-white backdrop-blur"
          role="toolbar"
          aria-label="Zoom controls"
        >
          <ToolbarButton label="Zoom out" onClick={() => zoomBy(-BUTTON_STEP)} disabled={!isZoomed}>
            <Minus className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <span className="min-w-[3.5rem] text-center text-xs tabular-nums" aria-live="polite">
            {Math.round(transform.scale * 100)}%
          </span>
          <ToolbarButton label="Zoom in" onClick={() => zoomBy(BUTTON_STEP)} disabled={transform.scale >= MAX_SCALE}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
          <ToolbarButton label="Fit to screen" onClick={reset}>
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Reset zoom" onClick={reset} disabled={!isZoomed}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
