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

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ImageOff, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhotoModal } from "@/components/officer/photo_modal";
import { resolveViewerSource } from "@/lib/ui/officer_photo_source";

interface GalleryEntry {
  id: number;
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewUrl: string | null;
  sourceType: string;
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
              return (
                <div key={entry.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(index)}
                    className="block aspect-square w-full overflow-hidden rounded-lg border border-border bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={`Open ${GROUP_LABEL[group.type]} image`}
                  >
                    {source.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external storage/Drive URL
                      <img
                        src={source.imageUrl}
                        alt={`${GROUP_LABEL[group.type]} of ${name}`}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        onError={
                          source.fallbackUrl
                            ? (e) => {
                                const img = e.currentTarget;
                                img.onerror = null;
                                img.src = source.fallbackUrl!;
                              }
                            : undefined
                        }
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted">
                        <ImageOff className="h-5 w-5" aria-hidden="true" />
                      </div>
                    )}
                  </button>

                  <div className="pointer-events-none absolute left-1 top-1 flex flex-wrap gap-1">
                    {entry.isProfile ? <Badge>Current</Badge> : null}
                    {isOfficial ? <Badge>⭐ Official</Badge> : null}
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
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={settingId !== null}
                      onClick={() => setOfficial(null)}
                      className="mt-1 w-full text-[11px]"
                    >
                      {settingId === -1 ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                      Unpin
                    </Button>
                  )}
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
    </div>
  );
}
