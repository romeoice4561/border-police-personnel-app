/**
 * DocumentsSection (Phase 29A / 29B — Officer Document Vault;
 *                   Phase 29C — Document Thumbnails;
 *                   Phase 30 — Version management;
 *                   Phase 30.1 — Download fix, thumbnail redesign, history UX).
 *
 * Shows every official document associated with an officer, organised by
 * document type. All action buttons are functional:
 *
 *   Upload / Replace  — POST /api/officers/{id}/documents
 *                       First upload sets version=1; subsequent uploads
 *                       auto-increment the version and demote the prior
 *                       active document (handled server-side).
 *   Preview           — opens fileUrl in a new tab
 *   Download          — GET /api/officers/{id}/documents/{docId}/download
 *                       (server-side proxy with Content-Disposition: attachment;
 *                       works for the current version AND every historical
 *                       version — Phase 30.1 ISSUE 4).
 *   History           — inline panel: GET …/documents/history?documentType=…
 *                       every version exposes Preview / Download; old
 *                       (inactive) versions can also be deleted individually.
 *   Delete            — inline confirm (with full details) → DELETE …/documents/{docId}
 *                       Version-aware: deleting the current version promotes
 *                       the next-latest version to Current automatically.
 *
 * Phase 30.1 UX notes:
 *   - The History panel is NEVER closed by Upload / Replace / Delete — it
 *     re-fetches only its own data (targeted refresh), preserving scroll
 *     position and open/closed accordion state.
 *   - Thumbnails use `object-cover` for card-like documents (ID cards,
 *     driver licenses, passports — DOCUMENT_FIT_COVER below) so the subject
 *     fills the frame and stays recognisable, and `object-contain` for
 *     A4-shaped documents/forms/certificates on a taller canvas so the whole
 *     page remains visible without cropping.
 *   - Thumbnail image swaps (Replace) cross-fade instead of hard-remounting.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  Eye,
  RefreshCw,
  Download,
  History,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  ChevronUp,
} from "lucide-react";
import type { OfficerDocument } from "@/lib/database/query_types";
import { getDocumentTypes, findDocumentType } from "@/lib/document/document_types";
import { ALLOWED_DOCUMENT_MIME, MAX_DOCUMENT_BYTES } from "@/lib/document/document_validation";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ACCEPT = Object.keys(ALLOWED_DOCUMENT_MIME).join(",");

export interface DocumentsSectionProps {
  officerId: string;
  documents: OfficerDocument[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function statusBadge(doc: OfficerDocument | null) {
  if (!doc) {
    return (
      <Badge tone="default">
        <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
        ยังไม่มี
      </Badge>
    );
  }
  if (doc.verifiedAt) {
    return (
      <Badge tone="good">
        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
        ตรวจแล้ว
      </Badge>
    );
  }
  return (
    <Badge tone="default">
      <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
      รอตรวจ
    </Badge>
  );
}

/** Triggers a browser download via a temporary anchor (works for any doc id — current or historical). */
function triggerDownload(officerId: string, docId: number) {
  const a = document.createElement("a");
  a.href = `/api/officers/${encodeURIComponent(officerId)}/documents/${docId}/download`;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openPreview(fileUrl: string | null | undefined) {
  if (fileUrl) window.open(fileUrl, "_blank", "noopener,noreferrer");
}

// ── Document thumbnail (Phase 30.1 ISSUE 2 — redesigned) ────────────────────

/**
 * Derives a Supabase image-render URL from a stored fileUrl.
 * Returns null for non-image MIME types (e.g. PDFs) or for URLs that don't
 * follow the Supabase Storage `/object/public/` pattern.
 * width=480 gives a sharp source for the enlarged thumbnail canvas
 * (Phase 30.1 ISSUE 2/5) while the render API preserves native aspect ratio.
 */
function deriveDocumentThumbnailUrl(
  fileUrl: string | null | undefined,
  mimeType: string | null | undefined
): string | null {
  if (!fileUrl || !mimeType?.startsWith("image/")) return null;
  const OBJECT_SEGMENT = "/storage/v1/object/public/";
  if (!fileUrl.includes(OBJECT_SEGMENT)) return null;
  return (
    fileUrl.replace(OBJECT_SEGMENT, "/storage/v1/render/image/public/") +
    "?width=480"
  );
}

/**
 * Document type codes that represent rigid, card-shaped identity documents.
 * These render with `object-cover` (fills the frame, centered) so the ID
 * photo/text stays large and legible — a small edge-crop is preferable to a
 * tiny, hard-to-read image.
 * Every other type (forms, certificates, registrations — typically A4-shaped)
 * renders with `object-contain` on a taller canvas so the full page is
 * always visible with zero cropping (Phase 30.1 ISSUE 2).
 */
const CARD_SHAPED_TYPES = new Set(["NATIONAL_ID", "OFFICER_CARD", "DRIVER_LICENSE", "PASSPORT"]);

type ThumbnailFit = "cover" | "contain";

function getThumbnailFit(documentTypeCode: string): ThumbnailFit {
  return CARD_SHAPED_TYPES.has(documentTypeCode) ? "cover" : "contain";
}

interface DocumentThumbnailProps {
  fileUrl: string | null | undefined;
  mimeType: string | null | undefined;
  documentTypeCode: string;
  /**
   * "md" = card-shaped types render 144×96 (landscape, cover);
   *        A4-shaped types render 112×144 (portrait, contain) — a bigger
   *        canvas per type so the whole document stays readable
   *        (Phase 30.1 ISSUE 2/5, ~"140×90 / 150×100" ballpark).
   * "sm" = 56×56 — history row (Phase 30.1 ISSUE 6, up from 48px).
   */
  size?: "md" | "sm";
  altText?: string;
}

/**
 * Thumbnail for a document card or history row.
 *
 * Phase 30.1 ISSUE 2: object-fit is chosen per document type — `cover` for
 * card-shaped IDs (fills frame, stays legible) and `contain` on an enlarged,
 * portrait-biased canvas for A4-shaped forms/certificates (never crops).
 *
 * Phase 30.1 ISSUE 7: replacing the image (new fileUrl for the same slot)
 * cross-fades between the old and new image instead of hard-remounting —
 * the old image stays visible while the new one loads, then fades out as
 * the new one fades in.
 */
function DocumentThumbnail({ fileUrl, mimeType, documentTypeCode, size = "md", altText = "Document" }: DocumentThumbnailProps) {
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
  // Tracks the last `thumbnailUrl` prop value seen — lets us detect a
  // change and adjust state DURING render (React's recommended pattern for
  // "reset/derive state when a prop changes"), avoiding a setState-in-effect
  // cascade for what is otherwise a same-render prop→state sync.
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
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/70">PDF</span>
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
        <div className="absolute inset-0 animate-pulse bg-border/40" aria-hidden="true" />
      ) : null}
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: number;
  version: number;
  uploadedAt: Date | string | null;
  uploadedBy: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  isActive: boolean;
  fileUrl: string | null;
}

interface HistoryPanelProps {
  officerId: string;
  typeCode: string;
  labelEn: string;
  onClose: () => void;
  /**
   * Bumped by the parent DocumentRow after Upload / Replace / card-level
   * Delete so the history list re-fetches to reflect those changes too —
   * WITHOUT the panel ever closing (Phase 30.1 ISSUE 3/6).
   */
  externalRefreshToken: number;
  /** Called after a version is deleted from within this panel so the card can refresh (thumbnail/version/badge). */
  onVersionDeleted?: () => void;
}

function HistoryPanel({ officerId, typeCode, labelEn, onClose, externalRefreshToken, onVersionDeleted }: HistoryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  // Optimistic fade-out — ids visually marked for removal before the actual refetch drops them.
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  // Increment to re-trigger the fetch effect after a delete performed inside this panel.
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      // Only show the blocking "loading" state for the very first fetch —
      // subsequent refreshes (Upload/Replace/Delete) keep the existing list
      // visible so scroll position and the open accordion are preserved
      // (Phase 30.1 ISSUE 3/6).
      setLoading((prev) => prev || entries.length === 0);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/officers/${encodeURIComponent(officerId)}/documents/history?documentType=${encodeURIComponent(typeCode)}`
        );
        if (cancelled) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? `Failed to load history (${res.status}).`);
        }
        const body = (await res.json()) as { data: HistoryEntry[] };
        if (!cancelled) setEntries(body.data ?? []);
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : "Failed to load history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void doLoad();
    return () => {
      cancelled = true;
    };
    // entries.length intentionally excluded — only used to decide the
    // *initial* loading treatment, not to re-trigger the fetch itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officerId, typeCode, internalRefreshKey, externalRefreshToken]);

  // Phase 30.1 ISSUE 4: per-version Delete (only for inactive/historical
  // entries — the Current version cannot be deleted from the History panel;
  // use the card's own Delete button for that, which shows the full
  // version-aware confirmation and promotion flow).
  const handleConfirmDelete = useCallback(async (entry: HistoryEntry) => {
    setConfirmId(null);
    // Optimistic fade-out before the network round-trip completes.
    setRemovingIds((prev) => new Set(prev).add(entry.id));
    setDeletingId(entry.id);
    setDeleteError(null);

    // Let the fade-out play briefly before firing the request.
    await new Promise((resolve) => window.setTimeout(resolve, 180));

    try {
      const res = await fetch(
        `/api/officers/${encodeURIComponent(officerId)}/documents/${entry.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Delete failed (${res.status}).`);
      }
      setInternalRefreshKey((k) => k + 1);
      onVersionDeleted?.();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed.");
      // Restore visibility — the delete failed, entry is still there.
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  }, [officerId, onVersionDeleted]);

  const isInitialLoading = loading && entries.length === 0;

  return (
    <div className="mt-2 rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">
          ประวัติเวอร์ชัน — {labelEn}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-foreground"
          aria-label="Close history"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {isInitialLoading && (
        <p className="flex items-center gap-1 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          กำลังโหลด…
        </p>
      )}

      {fetchError && (
        <p className="flex items-center gap-1 text-xs text-serious">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {fetchError}
        </p>
      )}

      {deleteError && (
        <p className="mb-2 flex items-center gap-1 text-xs text-serious" role="alert">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {deleteError}
        </p>
      )}

      {!isInitialLoading && !fetchError && entries.length === 0 && (
        <p className="text-xs text-muted">ยังไม่มีประวัติ</p>
      )}

      {!isInitialLoading && entries.length > 0 && (
        // Scroll container kept mounted across refreshes so scrollTop survives.
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const isRemoving = removingIds.has(entry.id);
            return (
              <li
                key={entry.id}
                className={`rounded-md transition-all duration-200 ${isRemoving ? "pointer-events-none scale-95 opacity-0" : "scale-100 opacity-100"}`}
              >
                <div className="flex items-start gap-2 text-xs">
                  {/* Phase 30.1 ISSUE 6: real thumbnail per history version (56px) */}
                  <DocumentThumbnail
                    fileUrl={entry.fileUrl}
                    mimeType={entry.mimeType}
                    documentTypeCode={typeCode}
                    size="sm"
                    altText={`v${entry.version}`}
                  />

                  <span className="mt-0.5 shrink-0">
                    {entry.isActive ? (
                      <CheckCircle2 className="h-3 w-3 text-good" aria-label="Active" />
                    ) : (
                      <Clock className="h-3 w-3 text-muted" aria-label="Inactive" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">v{entry.version}</span>
                    {entry.isActive ? (
                      <span className="ml-1 rounded-sm bg-good/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-good transition-colors duration-300">
                        Current
                      </span>
                    ) : null}
                    <span className="text-muted"> · {formatDate(entry.uploadedAt)}</span>
                    {entry.uploadedBy ? (
                      <span className="text-muted"> · {entry.uploadedBy}</span>
                    ) : null}
                    {entry.originalFilename ? (
                      <p className="truncate text-muted">{entry.originalFilename}</p>
                    ) : null}
                  </div>

                  {/* Phase 30.1 ISSUE 4: Preview + Download + Delete per version */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={!entry.fileUrl}
                      onClick={() => openPreview(entry.fileUrl)}
                      className="rounded p-1 text-muted hover:bg-neutral-bg hover:text-foreground disabled:opacity-40"
                      aria-label={`Preview version ${entry.version}`}
                      title="Preview"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={!entry.fileUrl}
                      onClick={() => triggerDownload(officerId, entry.id)}
                      className="rounded p-1 text-muted hover:bg-neutral-bg hover:text-foreground disabled:opacity-40"
                      aria-label={`Download version ${entry.version}`}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={entry.isActive || deletingId === entry.id}
                      onClick={() => setConfirmId(entry.id)}
                      className="rounded p-1 text-muted hover:bg-serious/10 hover:text-serious disabled:opacity-30 disabled:hover:bg-transparent"
                      aria-label={
                        entry.isActive
                          ? "Cannot delete the current version here — use the card's Delete button"
                          : `Delete version ${entry.version}`
                      }
                      title={entry.isActive ? "Current version cannot be deleted here" : "Delete"}
                    >
                      {deletingId === entry.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Phase 30.1 ISSUE 5: detailed per-version delete confirmation */}
                {confirmId === entry.id ? (
                  <div className="mt-1.5 space-y-1.5 rounded-md border border-serious/30 bg-serious/5 p-2.5 text-xs">
                    <p className="font-semibold text-foreground">Delete Version {entry.version}?</p>
                    <dl className="space-y-0.5 text-muted">
                      <div className="flex gap-1">
                        <dt className="font-medium text-foreground">Document:</dt>
                        <dd>{labelEn}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt className="font-medium text-foreground">Filename:</dt>
                        <dd className="truncate">{entry.originalFilename ?? "—"}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt className="font-medium text-foreground">Uploaded:</dt>
                        <dd>{formatDate(entry.uploadedAt)}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt className="font-medium text-foreground">Current Version:</dt>
                        <dd>No</dd>
                      </div>
                    </dl>
                    <p className="font-medium text-serious">This operation cannot be undone.</p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleConfirmDelete(entry)}
                        className="border-serious/40 text-serious hover:bg-serious/10"
                      >
                        Delete
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────

interface DocumentRowProps {
  officerId: string;
  typeCode: string;
  doc: OfficerDocument | null;
  /** Every version (active + inactive) of this type, newest first — used to preview the promotion target in the delete confirmation. */
  allVersions: OfficerDocument[];
  onRefresh: () => void;
}

function DocumentRow({ officerId, typeCode, doc, allVersions, onRefresh }: DocumentRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Bumped after Upload / Replace / card-level Delete so the (independently
  // fetched) History panel re-fetches too — without ever closing it.
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  // Brief fade-out shown right before a fully-deleted card reverts to empty.
  const [fadingOut, setFadingOut] = useState(false);

  const def = findDocumentType(typeCode);
  const labelEn = def?.labelEn ?? typeCode;
  const labelTh = def?.labelTh ?? typeCode;

  // The version that will become Current if the active `doc` is deleted —
  // computed from data already available client-side (no extra request),
  // mirrors the server's promoteLatestInactiveForType() selection.
  const nextVersionOnDelete = useMemo(() => {
    if (!doc) return null;
    const candidates = allVersions.filter((d) => d.id !== doc.id && !d.isActive);
    if (candidates.length === 0) return null;
    return candidates.reduce((max, d) => (d.version > max.version ? d : max), candidates[0]).version;
  }, [doc, allVersions]);

  // ── Upload / Replace ────────────────────────────────────────────────────────
  const handleFileSelected = useCallback(
    async (file: File) => {
      setError(null);

      if (!ALLOWED_DOCUMENT_MIME[file.type]) {
        setError("Unsupported file type. Allowed: JPG, PNG, WEBP, PDF.");
        return;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        setError(`File too large. Maximum ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.`);
        return;
      }

      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file, file.name);
        form.append("documentType", typeCode);
        form.append("title", labelEn);
        const res = await fetch(
          `/api/officers/${encodeURIComponent(officerId)}/documents`,
          { method: "POST", body: form }
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? `Upload failed (${res.status}).`);
        }
        // Phase 30.1 ISSUE 3/6: keep the History panel open; only refresh data.
        setHistoryRefreshToken((v) => v + 1);
        onRefresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [officerId, typeCode, labelEn, onRefresh]
  );

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!doc) return;
    triggerDownload(officerId, doc.id);
  }, [officerId, doc]);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = useCallback(async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/officers/${encodeURIComponent(officerId)}/documents/${doc.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Delete failed (${res.status}).`);
      }
      setConfirmDelete(false);
      // Phase 30.1 ISSUE 3/6: keep the History panel open; only refresh data.
      setHistoryRefreshToken((v) => v + 1);
      // Phase 30.1 ISSUE 7: brief fade before the card reverts to "no document".
      setFadingOut(true);
      window.setTimeout(() => setFadingOut(false), 200);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }, [officerId, doc, onRefresh]);

  return (
    <li className="rounded-lg border border-border bg-neutral-bg p-3">
      {/* Header: thumbnail on the left, type info + badge on the right */}
      <div className={`mb-2 flex items-start gap-2.5 transition-opacity duration-200 ${fadingOut ? "opacity-40" : "opacity-100"}`}>
        <DocumentThumbnail
          fileUrl={doc?.fileUrl}
          mimeType={doc?.mimeType}
          documentTypeCode={typeCode}
          altText={labelEn}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{labelEn}</p>
              <p className="text-xs text-muted">{labelTh}</p>
            </div>
            <div className="shrink-0 transition-all duration-300">{statusBadge(doc)}</div>
          </div>

          {/* Document metadata */}
          {doc ? (
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-3">
              <span>
                <span className="font-medium text-foreground">อัพโหลด:</span> {formatDate(doc.uploadedAt)}
              </span>
              <span>
                <span className="font-medium text-foreground">เวอร์ชัน:</span> {doc.version}
              </span>
              {doc.originalFilename ? (
                <span className="truncate">
                  <span className="font-medium text-foreground">ไฟล์:</span> {doc.originalFilename}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Error */}
      {error ? (
        <p className="mb-2 flex items-center gap-1 text-xs text-serious" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {/* Phase 30.1 ISSUE 5: detailed delete confirmation for the current version */}
      {confirmDelete && doc ? (
        <div className="mb-2 space-y-1.5 rounded-md border border-serious/30 bg-serious/5 p-2.5 text-xs">
          <p className="font-semibold text-foreground">Delete Version {doc.version}?</p>
          <dl className="space-y-0.5 text-muted">
            <div className="flex gap-1">
              <dt className="font-medium text-foreground">Document:</dt>
              <dd>{labelEn}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="font-medium text-foreground">Filename:</dt>
              <dd className="truncate">{doc.originalFilename ?? "—"}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="font-medium text-foreground">Uploaded:</dt>
              <dd>{formatDate(doc.uploadedAt)}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="font-medium text-foreground">Current Version:</dt>
              <dd>Yes</dd>
            </div>
          </dl>
          {nextVersionOnDelete !== null ? (
            <p className="text-foreground">
              Deleting this version will automatically promote{" "}
              <span className="font-semibold">Version {nextVersionOnDelete}</span> to Current. Continue?
            </p>
          ) : (
            <p className="text-foreground">
              This is the only version — deleting it will remove the entire document history for this type. Continue?
            </p>
          )}
          <p className="font-medium text-serious">This operation cannot be undone.</p>
          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={handleDeleteConfirm}
              className="border-serious/40 text-serious hover:bg-serious/10"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Upload / Replace */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          aria-label={doc ? `Replace ${labelEn}` : `Upload ${labelEn}`}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : doc ? (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {doc ? "Replace" : "Upload"}
        </Button>

        {/* Preview */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!doc?.fileUrl}
          onClick={() => openPreview(doc?.fileUrl)}
          aria-label={`Preview ${labelEn}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Preview
        </Button>

        {/* Download */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!doc?.fileUrl || busy}
          onClick={handleDownload}
          aria-label={`Download ${labelEn}`}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download
        </Button>

        {/* History */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!doc}
          onClick={() => setHistoryOpen((v) => !v)}
          aria-label={`History for ${labelEn}`}
          aria-expanded={historyOpen}
        >
          {historyOpen ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <History className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          History
        </Button>

        {/* Delete */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!doc || busy}
          onClick={() => setConfirmDelete((v) => !v)}
          aria-label={`Delete ${labelEn}`}
          className={doc ? "hover:text-serious" : ""}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </Button>
      </div>

      {/* History panel (inline, expandable) — Phase 30.1 ISSUE 3/6: never
          closed by Upload/Replace/Delete; only its data is refreshed. */}
      {historyOpen ? (
        <HistoryPanel
          officerId={officerId}
          typeCode={typeCode}
          labelEn={labelEn}
          onClose={() => setHistoryOpen(false)}
          externalRefreshToken={historyRefreshToken}
          onVersionDeleted={onRefresh}
        />
      ) : null}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelected(file);
          e.target.value = "";
        }}
      />
    </li>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export function DocumentsSection({ officerId, documents }: DocumentsSectionProps) {
  const router = useRouter();

  const onRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const documentTypes = getDocumentTypes();

  // Most recent active document per type, and every version per type
  // (active + inactive — used to preview the delete/promotion outcome).
  const activeByType = new Map<string, OfficerDocument>();
  const allVersionsByType = new Map<string, OfficerDocument[]>();
  for (const doc of documents) {
    const list = allVersionsByType.get(doc.documentType);
    if (list) list.push(doc);
    else allVersionsByType.set(doc.documentType, [doc]);

    if (doc.isActive) {
      const existing = activeByType.get(doc.documentType);
      if (!existing || doc.version > existing.version) {
        activeByType.set(doc.documentType, doc);
      }
    }
  }

  // Active documents whose type is not in the built-in registry (future/custom types).
  const unknownTypeCodes = new Set<string>();
  for (const doc of documents) {
    if (doc.isActive && !documentTypes.find((t) => t.code === doc.documentType)) {
      unknownTypeCodes.add(doc.documentType);
    }
  }

  const uploadedCount = activeByType.size;
  const totalTypes = documentTypes.length + unknownTypeCodes.size;

  return (
    <EditableSectionCard
      title={`เอกสารประจำตัว / Officer Documents (${uploadedCount}/${totalTypes})`}
    >
      <ul className="space-y-3">
        {documentTypes.map((typeDef) => (
          <DocumentRow
            key={typeDef.code}
            officerId={officerId}
            typeCode={typeDef.code}
            doc={activeByType.get(typeDef.code) ?? null}
            allVersions={allVersionsByType.get(typeDef.code) ?? []}
            onRefresh={onRefresh}
          />
        ))}

        {[...unknownTypeCodes].map((code) => (
          <DocumentRow
            key={code}
            officerId={officerId}
            typeCode={code}
            doc={activeByType.get(code) ?? null}
            allVersions={allVersionsByType.get(code) ?? []}
            onRefresh={onRefresh}
          />
        ))}
      </ul>
    </EditableSectionCard>
  );
}
