/**
 * EpfDetailDrawer (Phase 46 — Electronic Personnel File Foundation;
 * Phase 47 — adds an Expiry Information section: Issue Date, Expiry Date,
 * Renewal Date [editable, saved via the same PATCH as title/description],
 * plus derived Days Remaining/Status read from
 * lib/document/document_expiry.ts — never computed inline here;
 * Phase 47A — the three date fields now use the shared ThaiDatePicker
 * (Buddhist-Era, Thai month names, DD/MM/YYYY display) in `outputFormat="iso"`
 * mode instead of the browser-native `<input type="date">`, which always
 * renders Gregorian years and English month names. The picker's onChange
 * still hands back a plain ISO "yyyy-mm-dd" string — the wire format to the
 * API/database is completely unchanged, only the picking UI is Thai now.).
 *
 * Right-side drawer showing a document's large preview, editable metadata,
 * expiry information, notes/remarks, a simple timeline, full version
 * history, and a disabled "AI Analysis" placeholder (no OCR/AI in this
 * phase — foundation only).
 *
 * `title`, `description`, `issueDate`, `expiryDate`, `renewalDate` are the
 * only fields saved via PATCH here (see
 * lib/database/repositories/document_repository.ts). Document Number,
 * Issuing Agency, and Tags still have no backing storage — noted, not
 * fabricated.
 */
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { OfficerDocument } from "@/lib/database/query_types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThaiDatePicker, THAI_EXPIRY_YEAR_BE_MIN, THAI_EXPIRY_YEAR_BE_MAX } from "@/components/ui/thai_date_picker";
import { DocumentThumbnail } from "@/components/ui/media/DocumentThumbnail";
import { DocumentStatusBadge } from "@/components/ui/media/DocumentStatusBadge";
import { EpfHistoryPanel } from "@/components/officer/epf/epf_history_panel";
import { EpfExtractionPanel } from "@/components/officer/epf/epf_extraction_panel";
import { categoryForTypeCode } from "@/lib/document/document_categories";
import { getDocumentTypeLabel, resolveDocumentDisplayTitle } from "@/lib/document/document_type_labels";
import { expiryStatus, daysRemaining, EXPIRY_STATUS_TONE, type ExpiryStatus } from "@/lib/document/document_expiry";
import { useLanguage, useT } from "@/components/i18n/language_provider";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return formatShortThaiDateTh(date);
}

/** Formats a Date/string into the yyyy-mm-dd value ThaiDatePicker's outputFormat="iso" expects. */
function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const EXPIRY_YEAR_RANGE = { min: THAI_EXPIRY_YEAR_BE_MIN, max: THAI_EXPIRY_YEAR_BE_MAX };

const STATUS_LABEL_KEY: Record<ExpiryStatus, TranslationKey> = {
  valid: "epf.expiry.statusValid",
  expiring_soon: "epf.expiry.statusExpiringSoon",
  expired: "epf.expiry.statusExpired",
  unknown: "epf.expiry.statusUnknown",
};

export function EpfDetailDrawer({
  open,
  onClose,
  officerId,
  typeCode,
  doc,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  officerId: string;
  typeCode: string;
  doc: OfficerDocument | null;
  onRefresh: () => void;
}) {
  const { t } = useT();
  const { language } = useLanguage();
  const typeLabel = getDocumentTypeLabel(typeCode, language);
  const displayTitle = resolveDocumentDisplayTitle(doc?.title, typeCode, language);
  const category = categoryForTypeCode(typeCode);

  const [title, setTitle] = useState(displayTitle);
  const [description, setDescription] = useState(doc?.description ?? "");
  const [issueDate, setIssueDate] = useState(toDateInputValue(doc?.issueDate));
  const [expiryDate, setExpiryDate] = useState(toDateInputValue(doc?.expiryDate));
  const [renewalDate, setRenewalDate] = useState(toDateInputValue(doc?.renewalDate));
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

  if (!open) return null;

  // Live preview of status/days-remaining as the user edits the field —
  // always derived via the shared engine, never computed inline.
  const previewStatus = expiryStatus(expiryDate || null);
  const previewDaysRemaining = expiryDate ? daysRemaining(expiryDate) : null;

  async function handleSave() {
    if (!doc) return;
    setSaving(true);
    setSaveState("idle");
    try {
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          issueDate: issueDate || null,
          expiryDate: expiryDate || null,
          renewalDate: renewalDate || null,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status}).`);
      setSaveState("saved");
      onRefresh();
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Phase 48 (spec §15): populates the existing metadata form fields from
   * user-approved extraction values — never writes to the document
   * directly. The existing "บันทึก"/Save button (handleSave above) is
   * still the ONLY thing that actually persists anything, so approving an
   * extracted value requires the exact same explicit user action as any
   * manual edit. Only issueDate/expiryDate/renewalDate/title/description
   * ever reach here — EpfExtractionPanel already filters out identity-like
   * fields before calling this.
   */
  function handleApprovedFieldsFromExtraction(fields: Record<string, string>) {
    if (fields.title !== undefined) setTitle(fields.title);
    if (fields.description !== undefined) setDescription(fields.description);
    if (fields.issueDate !== undefined) setIssueDate(fields.issueDate);
    if (fields.expiryDate !== undefined) setExpiryDate(fields.expiryDate);
    if (fields.renewalDate !== undefined) setRenewalDate(fields.renewalDate);
  }

  return (
    <Drawer open={open} onClose={onClose} titleId="epf-detail-title" title={t("epf.detailTitle")}>
      <div className="space-y-5">
        <div className="flex justify-center rounded-lg bg-neutral-bg p-4">
          <DocumentThumbnail fileUrl={doc?.fileUrl} mimeType={doc?.mimeType} documentTypeCode={typeCode} size="md" altText={displayTitle} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <DocumentStatusBadge doc={doc} />
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {t("epf.cardAiReady")}
          </span>
        </div>

        <p className="wrap-break-word text-xs text-muted">{typeLabel}</p>

        <section aria-labelledby="epf-detail-metadata-heading" className="space-y-3">
          <h3 id="epf-detail-metadata-heading" className="text-sm font-semibold text-foreground">{t("epf.detailMetadataHeading")}</h3>

          <div className="space-y-1">
            <label htmlFor="epf-detail-title-field" className="text-xs font-medium text-muted">{t("epf.detailFieldTitle")}</label>
            <input
              id="epf-detail-title-field"
              type="text"
              value={title}
              disabled={!doc}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="epf-detail-description-field" className="text-xs font-medium text-muted">{t("epf.detailFieldDescription")}</label>
            <textarea
              id="epf-detail-description-field"
              value={description}
              disabled={!doc}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted">{t("epf.detailFieldCategory")}</span>
            <p className="text-sm text-foreground">{t(`epf.category.${category.code}` as TranslationKey)}</p>
          </div>

          <p className="rounded-md bg-neutral-bg px-2.5 py-2 text-[11px] text-muted">{t("epf.detailUnsupportedFieldsNote")}</p>
        </section>

        <section aria-labelledby="epf-detail-expiry-heading" className="space-y-3">
          <h3 id="epf-detail-expiry-heading" className="text-sm font-semibold text-foreground">{t("epf.expiry.detailHeading")}</h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="epf-detail-issue-date" className="text-xs font-medium text-muted">{t("epf.expiry.detailIssueDate")}</label>
              <ThaiDatePicker
                id="epf-detail-issue-date"
                value={issueDate}
                onChange={setIssueDate}
                disabled={!doc}
                outputFormat="iso"
                yearRangeBE={EXPIRY_YEAR_RANGE}
                showTodayButton
                aria-label={t("epf.expiry.detailIssueDate")}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="epf-detail-expiry-date" className="text-xs font-medium text-muted">{t("epf.expiry.detailExpiryDate")}</label>
              <ThaiDatePicker
                id="epf-detail-expiry-date"
                value={expiryDate}
                onChange={setExpiryDate}
                disabled={!doc}
                outputFormat="iso"
                yearRangeBE={EXPIRY_YEAR_RANGE}
                showTodayButton
                aria-label={t("epf.expiry.detailExpiryDate")}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="epf-detail-renewal-date" className="text-xs font-medium text-muted">{t("epf.expiry.detailRenewalDate")}</label>
              <ThaiDatePicker
                id="epf-detail-renewal-date"
                value={renewalDate}
                onChange={setRenewalDate}
                disabled={!doc}
                outputFormat="iso"
                yearRangeBE={EXPIRY_YEAR_RANGE}
                showTodayButton
                aria-label={t("epf.expiry.detailRenewalDate")}
              />
            </div>
          </div>

          {doc ? (
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>
                {t("epf.expiry.detailDaysRemaining")}:{" "}
                <span className="font-medium text-foreground">{previewDaysRemaining ?? t("epf.expiry.detailNotSet")}</span>
              </span>
              <Badge tone={EXPIRY_STATUS_TONE[previewStatus]}>{t(STATUS_LABEL_KEY[previewStatus])}</Badge>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={!doc || saving} onClick={() => void handleSave()}>
              {t("epf.detailSave")}
            </Button>
            {saveState === "saved" ? <span className="text-xs text-good">{t("epf.detailSaved")}</span> : null}
            {saveState === "error" ? <span className="text-xs text-serious">{t("epf.detailSaveFailed")}</span> : null}
          </div>
        </section>

        <section aria-labelledby="epf-detail-timeline-heading" className="space-y-2">
          <h3 id="epf-detail-timeline-heading" className="text-sm font-semibold text-foreground">{t("epf.detailTimelineHeading")}</h3>
          {doc ? (
            <ul className="space-y-1 text-xs text-muted">
              <li>{t("epf.cardUploadedDate")}: {formatDate(doc.uploadedAt)}</li>
              <li>{t("epf.cardUploadedBy")}: {doc.uploadedBy ?? "—"}</li>
              {doc.verifiedAt ? <li>{t("document.statusVerified")}: {formatDate(doc.verifiedAt)}</li> : null}
              {doc.issueDate ? <li>{t("epf.expiry.detailIssueDate")}: {formatDate(doc.issueDate)}</li> : null}
              {doc.expiryDate ? <li>{t("epf.expiry.detailExpiryDate")}: {formatDate(doc.expiryDate)}</li> : null}
              {doc.renewalDate ? <li>{t("epf.expiry.detailRenewalDate")}: {formatDate(doc.renewalDate)}</li> : null}
            </ul>
          ) : (
            <p className="text-xs text-muted">—</p>
          )}
        </section>

        <section aria-labelledby="epf-detail-history-heading" className="space-y-2">
          <h3 id="epf-detail-history-heading" className="text-sm font-semibold text-foreground">{t("epf.detailHistoryHeading")}</h3>
          {doc ? (
            <EpfHistoryPanel
              officerId={officerId}
              typeCode={typeCode}
              refreshToken={historyRefreshToken}
              onVersionDeleted={() => {
                setHistoryRefreshToken((v) => v + 1);
                onRefresh();
              }}
            />
          ) : (
            <p className="text-xs text-muted">—</p>
          )}
        </section>

        <EpfExtractionPanel
          officerId={officerId}
          docId={doc?.id ?? null}
          hasDocument={!!doc}
          onApprovedFieldsSave={handleApprovedFieldsFromExtraction}
        />
      </div>
    </Drawer>
  );
}
