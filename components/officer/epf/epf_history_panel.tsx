/**
 * EpfHistoryPanel (Phase 46 — Electronic Personnel File Foundation).
 *
 * Version history list for one document type, rendered inside the Detail
 * Drawer's "Upload History" section. Same endpoint and versioning semantics
 * as the original DocumentsSection HistoryPanel (GET .../history, per-version
 * Preview/Download/Delete) — behaviour intentionally unchanged, only the
 * container it's mounted in differs (drawer instead of inline card).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Download, Trash2, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { DocumentThumbnail } from "@/components/ui/media/DocumentThumbnail";
import { Button } from "@/components/ui/button";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return formatShortThaiDateTh(date);
}

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

export function EpfHistoryPanel({
  officerId,
  typeCode,
  refreshToken,
  onVersionDeleted,
}: {
  officerId: string;
  typeCode: string;
  refreshToken: number;
  onVersionDeleted?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/officers/${encodeURIComponent(officerId)}/documents/history?documentType=${encodeURIComponent(typeCode)}`
        );
        if (cancelled) return;
        if (!res.ok) throw new Error(`Failed to load history (${res.status}).`);
        const body = (await res.json()) as { data: HistoryEntry[] };
        if (!cancelled) setEntries(body.data ?? []);
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : "Failed to load history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [officerId, typeCode, internalRefreshKey, refreshToken]);

  const handleDelete = useCallback(
    async (entry: HistoryEntry) => {
      setConfirmId(null);
      setDeletingId(entry.id);
      try {
        const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/documents/${entry.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Delete failed (${res.status}).`);
        setInternalRefreshKey((k) => k + 1);
        onVersionDeleted?.();
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "Delete failed.");
      } finally {
        setDeletingId(null);
      }
    },
    [officerId, onVersionDeleted]
  );

  if (loading && entries.length === 0) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        …
      </p>
    );
  }

  if (fetchError) {
    return (
      <p className="flex items-center gap-1 text-xs text-serious" role="alert">
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        {fetchError}
      </p>
    );
  }

  if (entries.length === 0) {
    return <p className="text-xs text-muted">—</p>;
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-md border border-border p-2">
          <div className="flex items-start gap-2 text-xs">
            <DocumentThumbnail fileUrl={entry.fileUrl} mimeType={entry.mimeType} documentTypeCode={typeCode} size="sm" altText={`v${entry.version}`} />
            <span className="mt-1 shrink-0">
              {entry.isActive ? <CheckCircle2 className="h-3 w-3 text-good" aria-label="Active" /> : <Clock className="h-3 w-3 text-muted" aria-label="Inactive" />}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-1.5">
                <span className="font-medium text-foreground">v{entry.version}</span>
                <span className="text-muted">{formatDate(entry.uploadedAt)}</span>
                {entry.uploadedBy ? <span className="text-muted">by {entry.uploadedBy}</span> : null}
              </div>
              {entry.originalFilename ? <p className="truncate text-muted">{entry.originalFilename}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" disabled={!entry.fileUrl} onClick={() => openPreview(entry.fileUrl)} className="rounded p-1 text-muted hover:bg-neutral-bg hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40" aria-label={`Preview v${entry.version}`}>
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button type="button" disabled={!entry.fileUrl} onClick={() => triggerDownload(officerId, entry.id)} className="rounded p-1 text-muted hover:bg-neutral-bg hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40" aria-label={`Download v${entry.version}`}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button type="button" disabled={deletingId === entry.id} onClick={() => setConfirmId(entry.id)} className="rounded p-1 text-muted hover:bg-serious/10 hover:text-serious focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30" aria-label={`Delete v${entry.version}`}>
                {deletingId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            </div>
          </div>
          {confirmId === entry.id ? (
            <div className="mt-1.5 flex items-center gap-1.5 border-t border-border pt-1.5">
              <p className="flex-1 text-[11px] text-serious">This cannot be undone.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleDelete(entry)} className="border-serious/40 text-serious hover:bg-serious/10">
                Delete
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                Cancel
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
