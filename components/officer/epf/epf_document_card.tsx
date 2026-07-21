/**
 * EpfDocumentCard (Phase 46 — Electronic Personnel File Foundation).
 *
 * Redesigned document card per the e-PF spec: thumbnail, title, category,
 * issue date, uploaded date, file size, file type, uploaded by, status
 * badge, "AI Ready" placeholder badge, and Preview / Download / Details /
 * History / Upload-or-Replace actions.
 *
 * Reuses DocumentThumbnail and DocumentStatusBadge (Media Design System) —
 * no duplicated thumbnail/status rendering logic. Upload/download/history
 * wiring intentionally mirrors DocumentsSection's proven behaviour (same
 * endpoints, same versioning semantics) rather than reinventing it.
 *
 * "Issue Date" has no backing column on OfficerDocument yet (see
 * lib/document/epf_status_copy.ts for the same documented gap on status) —
 * shown as "—" until a future phase adds it, never fabricated.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Eye, RefreshCw, Download, History, Info, Sparkles, Loader2 } from "lucide-react";
import type { OfficerDocument } from "@/lib/database/query_types";
import { categoryForTypeCode } from "@/lib/document/document_categories";
import { getDocumentTypeLabel, resolveDocumentDisplayTitle } from "@/lib/document/document_type_labels";
import { ALLOWED_DOCUMENT_MIME, MAX_DOCUMENT_BYTES } from "@/lib/document/document_validation";
import { DocumentThumbnail } from "@/components/ui/media/DocumentThumbnail";
import { DocumentStatusBadge } from "@/components/ui/media/DocumentStatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage, useT } from "@/components/i18n/language_provider";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import { expiryStatus, EXPIRY_STATUS_TONE } from "@/lib/document/document_expiry";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ACCEPT = Object.keys(ALLOWED_DOCUMENT_MIME).join(",");

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return formatShortThaiDateTh(date);
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFileType(mimeType: string | null | undefined): string {
  if (!mimeType) return "—";
  const sub = mimeType.split("/")[1];
  return sub ? sub.toUpperCase() : mimeType;
}

/** Mirrors EXPIRY_STATUS_TONE's semantic tones as explicit Tailwind classes — a dynamic `text-${tone}` string cannot be statically detected by Tailwind's JIT scanner (same convention as components/workspace/kpi_card.tsx's TONE_TEXT map). */
const EXPIRY_TEXT_TONE_CLASS: Record<"good" | "warning" | "serious" | "neutral", string> = {
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  neutral: "text-muted",
};

function openPreview(fileUrl: string | null | undefined) {
  if (fileUrl) window.open(fileUrl, "_blank", "noopener,noreferrer");
}

function triggerDownload(officerId: string, docId: number) {
  const a = document.createElement("a");
  a.href = `/api/officers/${encodeURIComponent(officerId)}/documents/${docId}/download`;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function EpfDocumentCard({
  officerId,
  typeCode,
  doc,
  onRefresh,
  onOpenDetails,
  onOpenHistory,
  onOpenCreateUpload,
}: {
  officerId: string;
  typeCode: string;
  doc: OfficerDocument | null;
  onRefresh: () => void;
  onOpenDetails: () => void;
  onOpenHistory: () => void;
  /** Phase 49A.3: Create/Upload drawer (visible file picker) when no document exists yet. */
  onOpenCreateUpload: () => void;
}) {
  const { t } = useT();
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeLabel = getDocumentTypeLabel(typeCode, language);
  const displayTitle = resolveDocumentDisplayTitle(doc?.title, typeCode, language);
  const category = categoryForTypeCode(typeCode);

  const handleFileSelected = useCallback(
    async (file: File) => {
      setError(null);
      if (!ALLOWED_DOCUMENT_MIME[file.type]) {
        setError(t("epf.cardUploadErrorType"));
        return;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        setError(`${t("epf.cardUploadErrorSize")} (${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB)`);
        return;
      }
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file, file.name);
        form.append("documentType", typeCode);
        // Persist the active-locale built-in label; display re-localizes either locale's default.
        form.append("title", getDocumentTypeLabel(typeCode, language));
        const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/documents`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? t("epf.cardUploadErrorGeneric"));
        }
        onRefresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("epf.cardUploadErrorGeneric"));
      } finally {
        setBusy(false);
      }
    },
    [officerId, typeCode, language, onRefresh, t]
  );

  return (
    <li className="rounded-lg border border-border bg-neutral-bg p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <DocumentThumbnail
          fileUrl={doc?.fileUrl}
          mimeType={doc?.mimeType}
          documentTypeCode={typeCode}
          altText={displayTitle}
          previewAriaLabel={`${t("epf.cardPreviewThumbnail")} ${typeLabel}`}
          onClick={doc?.fileUrl ? () => openPreview(doc.fileUrl) : undefined}
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {/* Built-in defaults localize at display time; custom titles stay verbatim. */}
              <p className="wrap-break-word text-sm font-medium text-foreground">{displayTitle}</p>
              {displayTitle !== typeLabel ? (
                <p className="wrap-break-word text-xs text-muted">{typeLabel}</p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-muted">
                {t(`epf.category.${category.code}` as TranslationKey)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <DocumentStatusBadge doc={doc} />
              <Badge tone="accent" className="text-[10px]">
                <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
                {t("epf.cardAiReady")}
              </Badge>
            </div>
          </div>

          {doc ? (
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-2 lg:grid-cols-3">
              <span><span className="font-medium text-foreground">{t("epf.cardIssueDate")}:</span> {formatDate(doc.issueDate)}</span>
              {doc.expiryDate ? (
                <span>
                  <span className="font-medium text-foreground">{t("epf.cardExpiryDate")}:</span>{" "}
                  <span className={EXPIRY_TEXT_TONE_CLASS[EXPIRY_STATUS_TONE[expiryStatus(doc.expiryDate)]]}>{formatDate(doc.expiryDate)}</span>
                </span>
              ) : (
                <span><span className="font-medium text-foreground">{t("epf.cardExpiryDate")}:</span> {formatDate(doc.expiryDate)}</span>
              )}
              <span><span className="font-medium text-foreground">{t("epf.cardUploadedDate")}:</span> {formatDate(doc.uploadedAt)}</span>
              <span><span className="font-medium text-foreground">{t("epf.cardFileSize")}:</span> {formatFileSize(doc.fileSize)}</span>
              <span><span className="font-medium text-foreground">{t("epf.cardFileType")}:</span> {formatFileType(doc.mimeType)}</span>
              <span><span className="font-medium text-foreground">{t("epf.cardUploadedBy")}:</span> {doc.uploadedBy ?? "—"}</span>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-serious" role="alert">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            if (doc) fileInputRef.current?.click();
            else onOpenCreateUpload();
          }}
          aria-label={doc ? `${t("epf.cardReplace")} ${typeLabel}` : `${t("epf.cardUpload")} ${typeLabel}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : doc ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5" aria-hidden="true" />}
          {doc ? t("epf.cardReplace") : t("epf.cardUpload")}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!doc?.fileUrl}
          onClick={() => openPreview(doc?.fileUrl)}
          aria-label={`${t("epf.cardPreview")} ${typeLabel}`}
          title={!doc?.fileUrl ? t("epf.cardNoFileYet") : undefined}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {t("epf.cardPreview")}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!doc?.fileUrl || busy}
          onClick={() => doc && triggerDownload(officerId, doc.id)}
          aria-label={`${t("epf.cardDownload")} ${typeLabel}`}
          title={!doc?.fileUrl ? t("epf.cardNoFileYet") : undefined}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {t("epf.cardDownload")}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (doc) onOpenDetails();
            else onOpenCreateUpload();
          }}
          aria-label={`${t("epf.cardDetails")} ${typeLabel}`}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          {t("epf.cardDetails")}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!doc}
          onClick={onOpenHistory}
          aria-label={`${t("epf.cardHistory")} ${typeLabel}`}
          title={!doc ? t("epf.cardNoHistoryYet") : undefined}
        >
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          {t("epf.cardHistory")}
        </Button>
      </div>

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
