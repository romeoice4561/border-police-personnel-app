"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Camera, Loader2, RotateCcw, RotateCw, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CROP_OUTPUT_SIZE = 512;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface CroppedPortraitResult {
  blob: Blob;
  mimeType: string;
}

export interface PortraitCropDialogProps {
  sourceUrl: string;
  mimeType: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (result: CroppedPortraitResult) => void;
}

function clampZoom(value: number): number {
  return Math.min(4, Math.max(1, value));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load selected image."));
    img.src = src;
  });
}

async function createCroppedPortrait(
  imageSrc: string,
  croppedAreaPixels: Area,
  rotation: number,
  mimeType: string
): Promise<CroppedPortraitResult> {
  const image = await loadImage(imageSrc);
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotatedWidth = image.naturalWidth * cos + image.naturalHeight * sin;
  const rotatedHeight = image.naturalWidth * sin + image.naturalHeight * cos;

  const staging = document.createElement("canvas");
  staging.width = rotatedWidth;
  staging.height = rotatedHeight;
  const stagingCtx = staging.getContext("2d");
  if (!stagingCtx) throw new Error("Canvas is not available in this browser.");

  stagingCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
  stagingCtx.rotate(radians);
  stagingCtx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  const output = document.createElement("canvas");
  output.width = CROP_OUTPUT_SIZE;
  output.height = CROP_OUTPUT_SIZE;
  const outputCtx = output.getContext("2d");
  if (!outputCtx) throw new Error("Canvas is not available in this browser.");

  outputCtx.drawImage(
    staging,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    CROP_OUTPUT_SIZE,
    CROP_OUTPUT_SIZE
  );

  const outType = mimeType === "image/png" || mimeType === "image/webp" ? mimeType : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    output.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Could not generate cropped portrait."));
    }, outType, 0.92);
  });

  return { blob, mimeType: outType };
}

export function PortraitCropDialog({ sourceUrl, mimeType, busy, onCancel, onSave }: PortraitCropDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !saving) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
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
    },
    [busy, saving, onCancel]
  );

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);

    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
    };
  }, [handleKeyDown]);

  const handleCropComplete = useCallback((_croppedArea: Area, nextCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(nextCroppedAreaPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createCroppedPortrait(sourceUrl, croppedAreaPixels, rotation, mimeType);
      onSave(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate cropped portrait.");
      setSaving(false);
    }
  }, [croppedAreaPixels, sourceUrl, rotation, mimeType, onSave]);

  if (typeof document === "undefined") return null;

  const isBusy = busy || saving;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="portrait-crop-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isBusy) onCancel();
      }}
    >
      <div ref={dialogRef} className="w-full max-w-5xl rounded-2xl border border-border bg-neutral-bg p-4 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="portrait-crop-title" className="text-base font-semibold text-foreground">
              Crop Official Portrait
            </h2>
            <p className="text-xs text-muted">Drag, pinch, scroll, or use the zoom slider before saving.</p>
          </div>
          <button
            type="button"
            data-autofocus
            onClick={() => !isBusy && onCancel()}
            disabled={isBusy}
            aria-label="Cancel portrait crop"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative h-[min(68vh,520px)] min-h-80 overflow-hidden rounded-xl bg-black">
            <Cropper
              image={sourceUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              minZoom={1}
              maxZoom={4}
              zoomSpeed={0.18}
              zoomWithScroll
              onCropChange={setCrop}
              onZoomChange={(nextZoom) => setZoom(clampZoom(nextZoom))}
              onRotationChange={setRotation}
              onCropComplete={handleCropComplete}
              objectFit="contain"
              mediaProps={{ "aria-label": "Selected portrait image" }}
              cropperProps={{ "aria-label": "Interactive circular portrait crop area" }}
            />
          </div>

          <aside className="space-y-4 rounded-xl border border-border bg-surface p-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Live Preview</p>
              <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full border border-border bg-black sm:h-32 sm:w-32">
                <Cropper
                  image={sourceUrl}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  minZoom={1}
                  maxZoom={4}
                  zoomWithScroll={false}
                  onCropChange={() => undefined}
                  onZoomChange={() => undefined}
                  onCropComplete={() => undefined}
                  objectFit="contain"
                  restrictPosition
                  cropperProps={{ "aria-hidden": true, tabIndex: -1 }}
                  mediaProps={{ "aria-hidden": true }}
                />
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-foreground">Zoom</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
                disabled={isBusy}
                aria-label="Zoom portrait"
                className="w-full accent-accent"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => setRotation((v) => v - 90)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Left
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => setRotation((v) => v + 90)}>
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                Right
              </Button>
            </div>

            {error ? <p className="text-xs text-serious" role="alert">{error}</p> : null}

            <div className="flex flex-col gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={reset}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={isBusy || !croppedAreaPixels} onClick={handleSave}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
                Save Portrait
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
}
