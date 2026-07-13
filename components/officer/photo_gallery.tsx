/**
 * PhotoGallery (Phase 26A — Part 2: Photo Gallery).
 *
 * Shows every ProfilePhoto ever linked to this officer — Original Google
 * Drive Profile Card, Official Portrait, Uploaded Portraits, and any future
 * images — grouped and badged by photoType, as a thumbnail grid. Clicking a
 * thumbnail opens the shared PhotoModal (zoom/pan/rotate/download/open
 * original) with Previous/Next navigation across the fetched gallery set.
 *
 * The Original Google Drive Profile Card is NEVER hidden or deleted here —
 * this component only ever reads history and (optionally) changes the
 * officer's officialPortraitId display pointer via "Set as Official
 * Portrait"; it never removes a ProfilePhoto row.
 *
 * Fetched lazily on mount (one GET to the existing portrait/history
 * endpoint); "Set as Official Portrait" PUTs to
 * /api/officers/{id}/portrait/official and calls router.refresh() so the
 * rest of the page (header portrait, resolver tier) reflects the change.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, Download, Eye, ImageOff, Loader2, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhotoModal } from "@/components/officer/photo_modal";
import { resolveViewerSource } from "@/lib/ui/officer_photo_source";
import { GalleryImage } from "@/components/ui/media/GalleryImage";

interface GalleryEntry {
  id: number;
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  sourceType: string;
  matchStatus: string;
  photoType: "GOOGLE_PROFILE_CARD" | "OFFICIAL_PORTRAIT" | "UPLOADED" | "OTHER";
  isProfile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoGalleryProps {
  officerId: string;
  name: string;
  /** The currently pinned official portrait id (Officer.officialPortraitId), or null. */
  officialPortraitId: number | null;
  /**
   * Increment this key to force the gallery to re-fetch portrait history.
   * Use after Upload / Replace / Delete operations in PortraitManager so the
   * gallery reflects the change without a full page reload.
   */
  refreshKey?: number;
}

const GROUP_ORDER: GalleryEntry["photoType"][] = ["OFFICIAL_PORTRAIT", "GOOGLE_PROFILE_CARD", "UPLOADED", "OTHER"];

const GROUP_LABEL: Record<GalleryEntry["photoType"], string> = {
  OFFICIAL_PORTRAIT: "Official Portrait",
  GOOGLE_PROFILE_CARD: "Original Google Drive Card",
  UPLOADED: "Uploaded Portraits",
  OTHER: "Other Images",
};

export function PhotoGallery({ officerId, name, officialPortraitId, refreshKey = 0 }: PhotoGalleryProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingId, setSettingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GalleryEntry | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait/history`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load gallery (${res.status}).`);
        const body = (await res.json()) as { data: GalleryEntry[] };
        if (!cancelled) setEntries(body.data);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load gallery."));
    return () => {
      cancelled = true;
    };
  }, [officerId, refreshKey]);

  const grouped = useMemo(() => {
    if (!entries) return [];
    return GROUP_ORDER.map((type) => ({ type, items: entries.filter((e) => e.photoType === type) })).filter(
      (g) => g.items.length > 0
    );
  }, [entries]);

  async function setOfficial(id: number | null) {
    setSettingId(id ?? -1);
    setError(null);
    try {
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait/official`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Failed to set official portrait (${res.status}).`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set official portrait.");
    } finally {
      setSettingId(null);
    }
  }

  const downloadPhoto = useCallback((entry: GalleryEntry) => {
    const source = resolveViewerSource(entry);
    if (!source.imageUrl) return;
    const a = document.createElement("a");
    a.href = source.imageUrl;
    a.download = `${name.replace(/\s+/g, "_")}_${entry.id}.jpg`;
    a.rel = "noreferrer";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [name]);

  async function deletePhoto(entry: GalleryEntry) {
    setDeletingId(entry.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/officers/${encodeURIComponent(officerId)}/portrait/history/${entry.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Delete failed (${res.status}).`);
      }
      setEntries((prev) => prev?.filter((item) => item.id !== entry.id) ?? prev);
      setConfirmDelete(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  if (error && entries === null) {
    return (
      <p className="flex items-center gap-1 text-xs text-serious" role="alert">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>
    );
  }

  if (entries === null) {
    return (
      <div className="flex items-center justify-center py-8 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-8 text-center text-muted">
        <ImageOff className="h-6 w-6" aria-hidden="true" />
        <p className="text-sm">No images yet for this officer.</p>
      </div>
    );
  }

  const openPhoto = openIndex !== null ? entries[openIndex] : null;

  return (
    <div className="space-y-5">
      {error ? (
        <p className="flex items-center gap-1 text-xs text-serious" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {grouped.map((group) => (
        <div key={group.type} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{GROUP_LABEL[group.type]}</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {group.items.map((entry) => {
              const index = entries.indexOf(entry);
              const source = resolveViewerSource(entry);
              const isOfficial = entry.id === officialPortraitId;
              const isProtected = isOfficial || entry.isProfile;
              return (
                <div key={entry.id} className="group relative rounded-lg focus-within:ring-2 focus-within:ring-accent">
                  {/* Gallery thumbnails use rounded-rectangle (Part 5 — Photo
                      Gallery images are NOT portrait circles). Uses shared
                      GalleryImage component (Phase 30.2). */}
                  <button
                    type="button"
                    onClick={() => setOpenIndex(index)}
                    className="group block aspect-square w-full overflow-hidden rounded-lg border border-border bg-black/10 focus-visible:outline-none"
                    aria-label={`Open ${GROUP_LABEL[group.type]} image`}
                  >
                    <GalleryImage
                      src={source.imageUrl}
                      alt={`${GROUP_LABEL[group.type]} of ${name}`}
                      fallbackSrc={source.fallbackUrl}
                      hoverScale
                      className="h-full w-full"
                    />
                  </button>

                  <div className="pointer-events-none absolute inset-0 rounded-lg bg-black/0 transition-colors duration-150 group-hover:bg-black/25 group-focus-within:bg-black/25" />

                  <div className="pointer-events-none absolute left-1 top-1 flex flex-wrap gap-1">
                    {entry.isProfile ? <Badge>Current</Badge> : null}
                    {isOfficial ? <Badge>⭐ Official</Badge> : null}
                    {entry.photoType === "GOOGLE_PROFILE_CARD" ? <Badge>Original</Badge> : null}
                    {entry.photoType === "UPLOADED" ? <Badge>Gallery</Badge> : null}
                    {entry.sourceType === "DRIVE_SCAN" ? <Badge>Imported</Badge> : null}
                    {entry.matchStatus === "AUTO_MATCHED" ? <Badge>AI</Badge> : null}
                  </div>

                  <div className="absolute inset-x-1 bottom-1 grid grid-cols-4 gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => setOpenIndex(index)}
                      className="inline-flex h-7 items-center justify-center rounded bg-black/70 text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      aria-label={`Preview ${GROUP_LABEL[group.type]} image`}
                      title="Preview"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadPhoto(entry)}
                      disabled={!source.hasImage}
                      className="inline-flex h-7 items-center justify-center rounded bg-black/70 text-white hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      aria-label={`Download ${GROUP_LABEL[group.type]} image`}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => !isOfficial && void setOfficial(entry.id)}
                      disabled={isOfficial || settingId !== null}
                      className="inline-flex h-7 items-center justify-center rounded bg-black/70 text-white hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      aria-label={isOfficial ? "Already official portrait" : `Set ${GROUP_LABEL[group.type]} as official portrait`}
                      title={isOfficial ? "Official" : "Set Official"}
                    >
                      {settingId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Star className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(entry)}
                      disabled={deletingId === entry.id}
                      className="inline-flex h-7 items-center justify-center rounded bg-black/70 text-white hover:bg-serious disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      aria-label={isProtected ? "Review protected portrait deletion" : `Delete ${GROUP_LABEL[group.type]} image`}
                      title={isProtected ? "Protected" : "Delete"}
                    >
                      {deletingId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                  </div>

                  {!isOfficial ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={settingId !== null}
                      onClick={() => setOfficial(entry.id)}
                      className="mt-1 w-full text-[11px]"
                    >
                      {settingId === entry.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <Star className="h-3 w-3" aria-hidden="true" />
                      )}
                      Set Official
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {openPhoto ? (
        <PhotoModal
          open={openIndex !== null}
          onClose={() => setOpenIndex(null)}
          photo={openPhoto}
          name={name}
          title={GROUP_LABEL[openPhoto.photoType]}
          hasPrev={openIndex !== null && openIndex > 0}
          hasNext={openIndex !== null && openIndex < entries.length - 1}
          onPrev={openIndex !== null && openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined}
          onNext={openIndex !== null && openIndex < entries.length - 1 ? () => setOpenIndex(openIndex + 1) : undefined}
        />
      ) : null}

      {confirmDelete ? (
        <DeleteGalleryPhotoDialog
          entry={confirmDelete}
          name={name}
          isOfficial={confirmDelete.id === officialPortraitId}
          isDeleting={deletingId === confirmDelete.id}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => void deletePhoto(confirmDelete)}
        />
      ) : null}
    </div>
  );
}

function DeleteGalleryPhotoDialog({
  entry,
  name,
  isOfficial,
  isDeleting,
  onClose,
  onConfirm,
}: {
  entry: GalleryEntry;
  name: string;
  isOfficial: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const source = resolveViewerSource(entry);
  const protectedByCurrent = isOfficial || entry.isProfile;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [isDeleting, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-gallery-photo-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div ref={dialogRef} className="w-full max-w-md rounded-2xl border border-border bg-surface p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="delete-gallery-photo-title" className="text-sm font-semibold text-foreground">
              Delete gallery image?
            </h2>
            <p className="text-xs text-muted">{protectedByCurrent ? "This image is protected." : "This action cannot be undone."}</p>
          </div>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close delete confirmation"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mb-3 overflow-hidden rounded-lg border border-border bg-black/10">
          <GalleryImage src={source.imageUrl} fallbackSrc={source.fallbackUrl} alt={`Gallery image of ${name}`} className="aspect-video w-full" />
        </div>

        <div className="space-y-1 text-xs text-muted">
          <p><span className="font-medium text-foreground">Type:</span> {isOfficial ? "Current Official Portrait" : entry.isProfile ? "Current Portrait" : "Regular Gallery Image"}</p>
          <p><span className="font-medium text-foreground">Source:</span> {entry.sourceType === "DRIVE_SCAN" ? "Imported" : "Gallery upload"}</p>
          {protectedByCurrent ? (
            <p className="rounded-md border border-warning/30 bg-warning-bg p-2 text-warning">
              Choose another Official Portrait before deleting this image. The system will not leave the officer without a displayed portrait unintentionally.
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting || protectedByCurrent}
            className="bg-serious text-white hover:opacity-90"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            Delete
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
