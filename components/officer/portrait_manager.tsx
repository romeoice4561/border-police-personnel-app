/**
 * PortraitManager (Phase 24B-1 — Officer Portrait Upload; Phase 24B-2 —
 * source badge + portrait history).
 *
 * The portrait control in the profile header. Always shows the CURRENT portrait
 * (image or placeholder) plus which resolver tier produced it, so a reviewer
 * knows whose profile they are editing and how trustworthy the image is, and
 * drives the upload workflow:
 *
 *   Select image → Interactive crop dialog → Save Portrait → Upload original
 *   to history → Upload cropped portrait as current → refresh UI.
 *
 * Buttons: Upload/Replace Portrait (label switches once a portrait exists —
 * "if a Drive portrait exists, show it first, and Upload becomes Replace") /
 * Remove Portrait / Preview Full Size / History. Upload posts multipart/
 * form-data to /api/officers/{id}/portrait; on success router.refresh()
 * re-runs the server fetch so the profile, officer list, dashboard, and
 * gallery reflect the new portrait with no manual refresh.
 *
 * Client-side validation mirrors the server (jpg/jpeg/png/webp, ≤5 MB). The
 * square crop is produced on a canvas before upload, so the stored portrait is
 * already square. Google Drive is never involved — bytes go to Supabase
 * Storage via the API.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, RefreshCw, Trash2, Maximize2, History, Loader2, AlertCircle } from "lucide-react";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { PortraitSourceBadge } from "@/components/officer/portrait_source_badge";
import { PortraitHistoryPanel } from "@/components/officer/portrait_history_panel";
import { PhotoModal } from "@/components/officer/photo_modal";
import { PortraitCropDialog, type CroppedPortraitResult } from "@/components/officer/portrait_crop_dialog";
import { Button } from "@/components/ui/button";
import type { PortraitSource } from "@/lib/server/officer_portrait_service";
import {
  ALLOWED_PORTRAIT_MIME,
  validatePortrait,
} from "@/lib/portrait/portrait_validation";

export interface PortraitManagerProps {
  officerId: string;
  name: string;
  /** Current portrait thumbnail URL (from the resolved portrait), or null. */
  thumbnailUrl: string | null;
  driveFileId?: string | null;
  webViewUrl?: string | null;
  /** Which resolver tier produced `thumbnailUrl` (Phase 24B-2) — drives the source badge. */
  source: PortraitSource;
  /**
   * Called after a successful Upload, Replace, Delete, or history "Set as
   * Current" so the Photo Gallery can re-fetch without a full page reload.
   * The caller is responsible for calling router.refresh() if needed —
   * PortraitManager also calls router.refresh() independently.
   */
  onChanged?: () => void;
}

const ACCEPT = Object.keys(ALLOWED_PORTRAIT_MIME).join(",");

export function PortraitManager({ officerId, name, thumbnailUrl, driveFileId, webViewUrl, source, onChanged }: PortraitManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedSource, setPickedSource] = useState<{ file: File; url: string; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFull, setPreviewFull] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const hasPortrait = Boolean(thumbnailUrl);

  // Release the object URL when the crop source changes/unmounts.
  useEffect(() => {
    return () => {
      if (pickedSource) URL.revokeObjectURL(pickedSource.url);
    };
  }, [pickedSource]);

  const onPickFile = useCallback((file: File) => {
    setError(null);
    const validation = validatePortrait({ mimeType: file.type, byteLength: file.size });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setPickedSource({ file, url: URL.createObjectURL(file), mimeType: file.type });
  }, []);

  const uploadPortraitFile = useCallback(
    async (blob: Blob, mimeType: string, filename: string) => {
      const form = new FormData();
      form.append("file", blob, filename);
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Upload failed (${res.status}).`);
      }
      const body = (await res.json()) as { data: { id: number } };
      return body.data.id;
    },
    [officerId]
  );

  const setOfficialPortrait = useCallback(
    async (photoId: number) => {
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait/official`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Failed to set official portrait (${res.status}).`);
      }
    },
    [officerId]
  );

  async function saveCroppedPortrait(cropped: CroppedPortraitResult) {
    if (!pickedSource) return;

    setBusy(true);
    setError(null);
    try {
      // Preserve the user's original image in existing portrait history/gallery
      // before uploading the cropped version as the current official portrait.
      await uploadPortraitFile(pickedSource.file, pickedSource.mimeType, pickedSource.file.name || "original-portrait");

      const ext = ALLOWED_PORTRAIT_MIME[cropped.mimeType] ?? "jpg";
      const croppedPhotoId = await uploadPortraitFile(cropped.blob, cropped.mimeType, `portrait-cropped.${ext}`);
      await setOfficialPortrait(croppedPhotoId);

      setPickedSource(null);
      router.refresh();
      onChanged?.();
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
      onChanged?.();
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

      {/* Phase 24B-2: Current Portrait + Portrait Source, always visible together. */}
      <PortraitSourceBadge source={source} />

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

        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setHistoryOpen(true)}>
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          History
        </Button>
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

      {pickedSource ? (
        <PortraitCropDialog
          sourceUrl={pickedSource.url}
          mimeType={pickedSource.mimeType}
          busy={busy}
          onCancel={() => setPickedSource(null)}
          onSave={saveCroppedPortrait}
        />
      ) : null}

      {historyOpen ? (
        <PortraitHistoryPanel
          officerId={officerId}
          name={name}
          onClose={() => setHistoryOpen(false)}
          onChanged={() => { router.refresh(); onChanged?.(); }}
        />
      ) : null}

      <PhotoModal
        open={previewFull}
        onClose={() => setPreviewFull(false)}
        photo={{ driveFileId, thumbnailUrl, webViewUrl }}
        name={name}
      />
    </div>
  );
}

