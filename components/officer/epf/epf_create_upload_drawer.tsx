/**
 * EpfCreateUploadDrawer (Phase 49A.3) — Create/Upload mode for e-PF documents.
 *
 * Distinct from EpfDetailDrawer (details/metadata-edit for an existing doc).
 * Opens from “อัปโหลดเอกสารแรก” / missing / quick-upload with a visible
 * file picker first; metadata is optional and never blocks file selection.
 */
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FileText, ImageIcon, Upload, X } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ThaiDatePicker, THAI_EXPIRY_YEAR_BE_MIN, THAI_EXPIRY_YEAR_BE_MAX } from "@/components/ui/thai_date_picker";
import { categoryForTypeCode } from "@/lib/document/document_categories";
import { getDocumentTypeLabel } from "@/lib/document/document_type_labels";
import {
  EPF_CREATE_UPLOAD_ACCEPT,
  buildCreateUploadFormData,
  canSubmitCreateUpload,
  createUploadDisabledReason,
  defaultTitleForTypeCode,
  fileTypeLabel,
  formatFileSizeBytes,
  validateSelectedFile,
} from "@/lib/document/epf_create_upload";
import { useLanguage, useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/ui/cn";

const EXPIRY_YEAR_RANGE = { min: THAI_EXPIRY_YEAR_BE_MIN, max: THAI_EXPIRY_YEAR_BE_MAX };

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function EpfCreateUploadDrawer({
  open,
  onClose,
  officerId,
  typeCode,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  officerId: string;
  typeCode: string;
  onRefresh: () => void;
}) {
  const { t } = useT();
  const { language } = useLanguage();
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  const typeLabel = getDocumentTypeLabel(typeCode, language);
  const category = categoryForTypeCode(typeCode);

  // Parent remounts this drawer via `key={createTypeCode}` so draft state
  // resets without a setState-in-effect reset loop.
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState(() => defaultTitleForTypeCode(typeCode, language));
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  // Revoke object URLs on unmount only — no setState in the effect body.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const applyFile = useCallback(
    (next: File | null) => {
      setError(null);
      clearPreview();
      if (!next) {
        setFile(null);
        return;
      }
      const validation = validateSelectedFile(next);
      if (!validation.ok) {
        if (validation.code === "UNSUPPORTED_TYPE") setError(t("epf.cardUploadErrorType"));
        else if (validation.code === "TOO_LARGE") setError(`${t("epf.cardUploadErrorSize")} (10 MB)`);
        else if (validation.code === "EMPTY") setError(t("epf.createUploadErrorEmpty"));
        else setError(t("epf.cardUploadErrorGeneric"));
        setFile(null);
        return;
      }
      setFile(next);
      if (isImageMime(next.type)) {
        const url = URL.createObjectURL(next);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      }
    },
    [t, clearPreview]
  );

  const disabledReason = createUploadDisabledReason({ file, title, busy });
  const canSubmit = canSubmitCreateUpload({ file, title, busy });

  async function handleUploadAndSave() {
    if (!file || !canSubmit || uploadingRef.current) return;
    uploadingRef.current = true;
    setBusy(true);
    setProgress(10);
    setError(null);
    try {
      const form = buildCreateUploadFormData({
        file,
        documentType: typeCode,
        title,
        description,
      });
      setProgress(40);
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/documents`, {
        method: "POST",
        body: form,
      });
      setProgress(70);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? t("epf.cardUploadErrorGeneric"));
      }
      const payload = (await res.json().catch(() => null)) as { data?: { id?: number } } | null;
      const docId = payload?.data?.id;
      const hasDates = Boolean(issueDate || expiryDate || renewalDate);
      if (docId != null && hasDates) {
        setProgress(85);
        await fetch(`/api/officers/${encodeURIComponent(officerId)}/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueDate: issueDate || null,
            expiryDate: expiryDate || null,
            renewalDate: renewalDate || null,
          }),
        }).catch(() => undefined);
      }
      setProgress(100);
      onRefresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("epf.cardUploadErrorGeneric"));
      setProgress(null);
    } finally {
      setBusy(false);
      uploadingRef.current = false;
    }
  }

  if (!open) return null;

  const disabledHintKey: TranslationKey | null =
    disabledReason === "no_file"
      ? "epf.createUploadDisabledNoFile"
      : disabledReason === "empty_title"
        ? "epf.createUploadDisabledNoTitle"
        : disabledReason === "busy"
          ? "epf.createUploadDisabledBusy"
          : disabledReason === "invalid_file"
            ? "epf.createUploadDisabledInvalid"
            : null;

  return (
    <Drawer open={open} onClose={onClose} titleId="epf-create-upload-title" title={t("epf.createUploadTitle")}>
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="wrap-break-word text-sm font-medium text-foreground">{typeLabel}</p>
          <p className="text-xs text-muted">{t(`epf.category.${category.code}` as TranslationKey)}</p>
        </div>

        <section aria-labelledby="epf-create-file-heading" className="space-y-2">
          <h3 id="epf-create-file-heading" className="text-sm font-semibold text-foreground">
            {t("epf.createUploadSelectFile")}
          </h3>

          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept={EPF_CREATE_UPLOAD_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              e.target.value = "";
              applyFile(next);
            }}
          />

          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                applyFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                dragOver ? "border-accent bg-accent/5" : "border-border bg-neutral-bg hover:border-accent/60"
              )}
              data-testid="epf-create-dropzone"
            >
              <Upload className="h-8 w-8 text-muted" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{t("epf.createUploadDropHint")}</span>
              <span className="text-xs text-muted">{t("epf.createUploadAcceptedTypes")}</span>
            </button>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-neutral-bg p-3" data-testid="epf-create-selected-file">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview only
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : isImageMime(file.type) ? (
                  <ImageIcon className="h-7 w-7 text-muted" aria-hidden="true" />
                ) : (
                  <FileText className="h-7 w-7 text-muted" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted">
                  {fileTypeLabel(file)} · {formatFileSizeBytes(file.size)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                    {t("epf.createUploadChangeFile")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => applyFile(null)}
                    disabled={busy}
                    aria-label={t("epf.createUploadRemoveFile")}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("epf.createUploadRemoveFile")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="epf-create-metadata-heading" className="space-y-3">
          <h3 id="epf-create-metadata-heading" className="text-sm font-semibold text-foreground">
            {t("epf.detailMetadataHeading")}
          </h3>

          <div className="space-y-1">
            <label htmlFor="epf-create-title" className="text-xs font-medium text-muted">
              {t("epf.detailFieldTitle")}
            </label>
            <input
              id="epf-create-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="epf-create-description" className="text-xs font-medium text-muted">
              {t("epf.detailFieldDescription")}
            </label>
            <textarea
              id="epf-create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={busy}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted">{t("epf.detailFieldCategory")}</span>
            <p className="text-sm text-foreground">{t(`epf.category.${category.code}` as TranslationKey)}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="epf-create-issue-date" className="text-xs font-medium text-muted">
                {t("epf.expiry.detailIssueDate")}
              </label>
              <ThaiDatePicker
                id="epf-create-issue-date"
                value={issueDate}
                onChange={setIssueDate}
                disabled={busy}
                outputFormat="iso"
                yearRangeBE={EXPIRY_YEAR_RANGE}
                showTodayButton
                aria-label={t("epf.expiry.detailIssueDate")}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="epf-create-expiry-date" className="text-xs font-medium text-muted">
                {t("epf.expiry.detailExpiryDate")}
              </label>
              <ThaiDatePicker
                id="epf-create-expiry-date"
                value={expiryDate}
                onChange={setExpiryDate}
                disabled={busy}
                outputFormat="iso"
                yearRangeBE={EXPIRY_YEAR_RANGE}
                showTodayButton
                aria-label={t("epf.expiry.detailExpiryDate")}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="epf-create-renewal-date" className="text-xs font-medium text-muted">
                {t("epf.expiry.detailRenewalDate")}
              </label>
              <ThaiDatePicker
                id="epf-create-renewal-date"
                value={renewalDate}
                onChange={setRenewalDate}
                disabled={busy}
                outputFormat="iso"
                yearRangeBE={EXPIRY_YEAR_RANGE}
                showTodayButton
                aria-label={t("epf.expiry.detailRenewalDate")}
              />
            </div>
          </div>
        </section>

        {progress != null && busy ? (
          <div className="space-y-1" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted">{t("epf.createUploadProgress")}</p>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-serious" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button type="button" size="sm" disabled={!canSubmit} onClick={() => void handleUploadAndSave()} data-testid="epf-create-submit">
            {t("epf.createUploadSubmit")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={busy}>
            {t("epf.detailCancel")}
          </Button>
          {disabledHintKey && !canSubmit ? <span className="text-xs text-muted">{t(disabledHintKey)}</span> : null}
        </div>
      </div>
    </Drawer>
  );
}
