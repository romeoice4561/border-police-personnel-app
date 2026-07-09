/**
 * PortraitManager (Phase 24B-1 — Officer Portrait Upload).
 *
 * The portrait control in the profile header. Always shows the CURRENT portrait
 * (image or placeholder) so a reviewer knows whose profile they are editing,
 * and drives the upload workflow:
 *
 *   Select image → Preview → Crop (square) → Confirm → Upload → refresh UI.
 *
 * Buttons: Upload / Replace Portrait / Remove Portrait / Preview Full Size.
 * Upload posts multipart/form-data to /api/officers/{id}/portrait; on success
 * router.refresh() re-runs the server fetch so the profile, officer list,
 * dashboard, and gallery reflect the new portrait with no manual refresh.
 *
 * Client-side validation mirrors the server (jpg/jpeg/png/webp, ≤5 MB). The
 * square crop is produced on a canvas before upload, so the stored portrait is
 * already square. Google Drive is never involved — bytes go to Supabase
 * Storage via the API.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Camera, Upload, RefreshCw, Trash2, Maximize2, Loader2, X, AlertCircle } from "lucide-react";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { Button } from "@/components/ui/button";
import {
  ALLOWED_PORTRAIT_MIME,
  MAX_PORTRAIT_BYTES,
  validatePortrait,
} from "@/lib/portrait/portrait_validation";

export interface PortraitManagerProps {
  officerId: string;
  name: string;
  /** Current portrait thumbnail URL (from the resolved portrait), or null. */
  thumbnailUrl: string | null;
  driveFileId?: string | null;
  webViewUrl?: string | null;
}

const ACCEPT = Object.keys(ALLOWED_PORTRAIT_MIME).join(",");
const CROP_OUTPUT_SIZE = 512;

export function PortraitManager({ officerId, name, thumbnailUrl, driveFileId, webViewUrl }: PortraitManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<{ url: string; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFull, setPreviewFull] = useState(false);

  const hasPortrait = Boolean(thumbnailUrl);

  // Release the object URL when the crop source changes/unmounts.
  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.url);
    };
  }, [source]);

  const onPickFile = useCallback((file: File) => {
    setError(null);
    const validation = validatePortrait({ mimeType: file.type, byteLength: file.size });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setSource({ url: URL.createObjectURL(file), mimeType: file.type });
  }, []);

  async function uploadBlob(blob: Blob, mimeType: string) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      const ext = ALLOWED_PORTRAIT_MIME[mimeType] ?? "jpg";
      form.append("file", blob, `portrait.${ext}`);
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Upload failed (${res.status}).`);
      }
      setSource(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!window.confirm("Remove the current portrait? Older portraits are kept in history.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Remove failed (${res.status}).`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <div className="relative">
        <OfficerPhoto
          thumbnailUrl={thumbnailUrl}
          driveFileId={driveFileId}
          webViewUrl={webViewUrl}
          name={name}
          size={80}
          enableViewer={false}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          aria-label={hasPortrait ? "Replace portrait" : "Upload portrait"}
        >
          {hasPortrait ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5" aria-hidden="true" />}
          {hasPortrait ? "Replace Portrait" : "Upload Portrait"}
        </Button>

        {hasPortrait ? (
          <>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setPreviewFull(true)}>
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              Preview Full Size
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              Remove Portrait
            </Button>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="flex items-center gap-1 text-xs text-serious" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickFile(file);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />

      {source ? (
        <CropDialog
          source={source}
          busy={busy}
          onCancel={() => setSource(null)}
          onConfirm={(blob) => uploadBlob(blob, source.mimeType)}
        />
      ) : null}

      {previewFull && thumbnailUrl ? (
        <FullSizePreview name={name} url={webViewUrl || thumbnailUrl} onClose={() => setPreviewFull(false)} />
      ) : null}
    </div>
  );
}

/** Square-crop dialog: shows the chosen image, lets the user confirm a centered square crop. */
function CropDialog({
  source,
  busy,
  onCancel,
  onConfirm,
}: {
  source: { url: string; mimeType: string };
  busy: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);

  const produceSquare = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = imgRef.current;
      if (!img) return resolve(null);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = CROP_OUTPUT_SIZE;
      canvas.height = CROP_OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);
      const outType = source.mimeType === "image/png" || source.mimeType === "image/webp" ? source.mimeType : "image/jpeg";
      canvas.toBlob((blob) => resolve(blob), outType, 0.92);
    });
  }, [source.mimeType]);

  async function confirm() {
    const blob = await produceSquare();
    if (blob && blob.size <= MAX_PORTRAIT_BYTES) onConfirm(blob);
    else if (blob) onConfirm(blob); // server re-validates; oversized handled there
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop portrait"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-neutral-bg p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Crop portrait (square)</h2>
          <button
            type="button"
            onClick={() => !busy && onCancel()}
            aria-label="Cancel"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-border/40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-full border border-border bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview; next/image not applicable */}
          <img
            ref={imgRef}
            src={source.url}
            alt="Portrait preview"
            onLoad={() => setReady(true)}
            className="h-full w-full object-cover"
          />
        </div>
        <p className="mt-2 text-center text-xs text-muted">A centered square is used. Preview shows the result.</p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={confirm} disabled={busy || !ready}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
            Confirm & Upload
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Minimal full-size portrait preview overlay. */
function FullSizePreview({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Portrait of ${name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white hover:bg-white/15"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- external storage URL; next/image remote loader intentionally unused */}
      <img src={url} alt={`Portrait of ${name}`} referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-lg object-contain" />
    </div>,
    document.body
  );
}
