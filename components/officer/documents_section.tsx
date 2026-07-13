/**
 * DocumentsSection (Phase 29A / 29B — Officer Document Vault;
 *                   Phase 29C — Document Thumbnails).
 *
 * Shows every official document associated with an officer, organised by
 * document type. All action buttons are functional in Phase 29B:
 *
 *   Upload / Replace  — POST /api/officers/{id}/documents
 *                       First upload sets version=1; subsequent uploads
 *                       auto-increment the version and demote the prior
 *                       active document (handled server-side).
 *   Preview           — opens fileUrl in a new tab
 *   Download          — GET /api/officers/{id}/documents/{docId}/download
 *                       (server-side proxy with Content-Disposition: attachment)
 *   History           — inline panel: GET …/documents/history?documentType=…
 *   Delete            — inline confirm → DELETE …/documents/{docId}
 *
 * Phase 29C adds a visual thumbnail on the left of every document card and
 * beside each history version row. For image documents (JPG/PNG/WEBP) a
 * Supabase render URL is derived from the stored fileUrl; for PDFs and other
 * non-image types a styled file icon is shown instead. No additional API
 * requests are made and no storage behaviour is modified.
 *
 * Layout mirrors Salary History and Career Timeline: EditableSectionCard
 * wrapping a list of DocumentRow items.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// ── Document thumbnail ────────────────────────────────────────────────────────

/**
 * Derives a Supabase image-render URL from a stored fileUrl.
 * Returns null for non-image MIME types (e.g. PDFs) or for URLs that don't
 * follow the Supabase Storage `/object/public/` pattern.
 * Uses width=320 without a height constraint so the render API returns the
 * image at its native aspect ratio — the browser then applies object-contain
 * to fit it without cropping (PART 4).
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
    "?width=320"
  );
}

interface DocumentThumbnailProps {
  fileUrl: string | null | undefined;
  mimeType: string | null | undefined;
  /**
   * "md" = 80 × 80 px — document card header (PART 5: ~43% larger than old 56px).
   * "sm" = 48 × 48 px — history row     (PART 6: real thumbnail replacing tiny icon).
   */
  size?: "md" | "sm";
  altText?: string;
}

/**
 * Thumbnail for a document card or history row.
 *
 * PART 4: object-contain replaces object-cover — entire document is visible,
 * no cropping. Portrait, landscape, and square images all render correctly.
 * A subtle background fills the letterbox/pillarbox area. Padding ensures
 * the image never touches the border edges.
 *
 * - Image documents (JPG/PNG/WEBP): Supabase render URL, animated skeleton
 *   while loading, silent fallback to icon on error.
 * - PDFs / other types: styled FileText icon (no broken browser icon).
 * - No document yet: neutral placeholder icon.
 *
 * Fixed outer dimensions on all branches prevent layout shift.
 */
function DocumentThumbnail({ fileUrl, mimeType, size = "md", altText = "Document" }: DocumentThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const thumbnailUrl = deriveDocumentThumbnailUrl(fileUrl, mimeType);
  const isPdf = mimeType === "application/pdf";
  const showImage = Boolean(thumbnailUrl && !imgError);

  // PART 5: md = 80px (was 56px — ~43% increase)
  // PART 6: sm = 48px (was 32px — real thumbnail replacing tiny icon)
  const sizeCls =
    size === "sm"
      ? "h-12 w-12 rounded"
      : "h-20 w-20 rounded-md";
  const iconCls =
    size === "sm"
      ? "h-4 w-4 text-muted"
      : "h-6 w-6 text-muted";

  return (
    // Outer container: fixed size, neutral background for letterbox areas,
    // subtle shadow + ring border, no overflow-hidden so shadow is visible.
    <div
      className={`relative shrink-0 ${sizeCls} bg-neutral-bg/80 shadow-sm ring-1 ring-border/30`}
    >
      {showImage ? (
        <>
          {/* Animated skeleton — hidden once the image has loaded */}
          {!loaded ? (
            <div
              className={`absolute inset-0 animate-pulse bg-border/40 ${sizeCls}`}
              aria-hidden="true"
            />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage render URL; next/image not applicable */}
          <img
            src={thumbnailUrl!}
            alt={altText}
            loading="lazy"
            // PART 4: object-contain — entire document visible, no crop.
            // p-1.5 gives breathing room so the image never touches the border.
            className={`absolute inset-0 h-full w-full object-contain p-1.5 transition-opacity duration-150 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            onError={() => setImgError(true)}
          />
        </>
      ) : (
        /* PDF / non-image / error fallback — never a broken browser icon */
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5">
          <FileText className={iconCls} aria-hidden="true" />
          {size === "md" && isPdf && fileUrl ? (
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted/70">PDF</span>
          ) : null}
        </div>
      )}
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
  /** Called after any version delete so the parent card can refresh. */
  onVersionDeleted?: () => void;
}

function HistoryPanel({ officerId, typeCode, labelEn, onClose, onVersionDeleted }: HistoryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Increment to re-trigger the fetch effect after a delete.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      setLoading(true);
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
  }, [officerId, typeCode, refreshKey]);

  // PART 3: delete an individual version from the history panel.
  const handleDeleteVersion = useCallback(async (entry: HistoryEntry, totalEntries: number) => {
    const isLast = totalEntries === 1;
    const confirmMsg = isLast
      ? `ลบเวอร์ชันสุดท้าย (v${entry.version})?\nเอกสารประเภทนี้จะถูกลบทั้งหมด ยืนยัน?`
      : entry.isActive
        ? `ลบเวอร์ชันปัจจุบัน v${entry.version}?\nเวอร์ชันก่อนหน้าจะถูกตั้งเป็นปัจจุบันโดยอัตโนมัติ`
        : `ลบ v${entry.version} ออกจากประวัติ?`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingId(entry.id);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/officers/${encodeURIComponent(officerId)}/documents/${entry.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Delete failed (${res.status}).`);
      }
      // Re-trigger the fetch effect to reflect the change.
      setRefreshKey((k) => k + 1);
      onVersionDeleted?.();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }, [officerId, onVersionDeleted]);

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

      {loading && (
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
        <p className="flex items-center gap-1 text-xs text-serious" role="alert">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {deleteError}
        </p>
      )}

      {!loading && !fetchError && entries.length === 0 && (
        <p className="text-xs text-muted">ยังไม่มีประวัติ</p>
      )}

      {!loading && entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 text-xs">
              {/* PART 6: real thumbnail per history version (48px) */}
              <DocumentThumbnail
                key={entry.id}
                fileUrl={entry.fileUrl}
                mimeType={entry.mimeType}
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
                  <span className="ml-1 rounded-sm bg-good/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-good">
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

              {/* View + Delete per version (PART 3) */}
              <div className="flex shrink-0 items-center gap-1">
                {entry.fileUrl ? (
                  <a
                    href={entry.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-link hover:underline"
                  >
                    View
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={deletingId === entry.id}
                  onClick={() => void handleDeleteVersion(entry, entries.length)}
                  className="text-xs text-muted hover:text-serious disabled:opacity-40"
                  aria-label={`Delete version ${entry.version}`}
                >
                  {deletingId === entry.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  )}
                </button>
              </div>
            </li>
          ))}
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
  onRefresh: () => void;
}

function DocumentRow({ officerId, typeCode, doc, onRefresh }: DocumentRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const def = findDocumentType(typeCode);
  const labelEn = def?.labelEn ?? typeCode;
  const labelTh = def?.labelTh ?? typeCode;

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
        setHistoryOpen(false);
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
    // Create a temporary anchor to trigger the browser download prompt.
    const a = document.createElement("a");
    a.href = `/api/officers/${encodeURIComponent(officerId)}/documents/${doc.id}/download`;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      setHistoryOpen(false);
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
      <div className="mb-2 flex items-start gap-2.5">
        {/* key=doc.id resets loaded/error state when the document is replaced */}
        <DocumentThumbnail
          key={doc?.id ?? "empty"}
          fileUrl={doc?.fileUrl}
          mimeType={doc?.mimeType}
          altText={labelEn}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{labelEn}</p>
              <p className="text-xs text-muted">{labelTh}</p>
            </div>
            <div className="shrink-0">{statusBadge(doc)}</div>
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

      {/* Delete confirmation prompt */}
      {confirmDelete ? (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-serious/30 bg-serious/5 px-2 py-1.5 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-serious" aria-hidden="true" />
          <span className="flex-1 text-foreground">
            {doc && doc.version > 1
              ? `ลบเวอร์ชัน v${doc.version}? เวอร์ชันก่อนหน้าจะถูกตั้งเป็นปัจจุบัน`
              : "ลบเวอร์ชันสุดท้าย? เอกสารประเภทนี้จะถูกลบทั้งหมด"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={handleDeleteConfirm}
            className="border-serious/40 text-serious hover:bg-serious/10"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            ยืนยัน
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmDelete(false)}
          >
            ยกเลิก
          </Button>
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
          onClick={() => {
            if (doc?.fileUrl) window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
          }}
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
          onClick={() => {
            setConfirmDelete((v) => !v);
            setHistoryOpen(false);
          }}
          aria-label={`Delete ${labelEn}`}
          className={doc ? "hover:text-serious" : ""}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </Button>
      </div>

      {/* History panel (inline, expandable) */}
      {historyOpen ? (
        <HistoryPanel
          officerId={officerId}
          typeCode={typeCode}
          labelEn={labelEn}
          onClose={() => setHistoryOpen(false)}
          onVersionDeleted={() => {
            setHistoryOpen(false);
            onRefresh();
          }}
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

  // Most recent active document per type.
  const activeByType = new Map<string, OfficerDocument>();
  for (const doc of documents) {
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
            onRefresh={onRefresh}
          />
        ))}

        {[...unknownTypeCodes].map((code) => (
          <DocumentRow
            key={code}
            officerId={officerId}
            typeCode={code}
            doc={activeByType.get(code) ?? null}
            onRefresh={onRefresh}
          />
        ))}
      </ul>
    </EditableSectionCard>
  );
}
