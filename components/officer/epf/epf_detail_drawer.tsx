/**
 * EpfDetailDrawer (Phase 46 — Electronic Personnel File Foundation).
 *
 * Right-side drawer showing a document's large preview, editable metadata,
 * notes/remarks, a simple timeline, full version history, and a disabled
 * "AI Analysis" placeholder (no OCR/AI in this phase — foundation only).
 *
 * Only `title` and `description` are real, persisted columns on
 * OfficerDocument (see lib/database/repositories/document_repository.ts) —
 * those are the only fields saved via PATCH here. Document Number, Issue
 * Date, Issuing Agency, and Tags have no backing storage yet; shown as
 * disabled/placeholder fields with an explicit note rather than silently
 * dropped or faked.
 */
"use client";

import { useState } from "react";
import { Sparkles, FileText } from "lucide-react";
import type { OfficerDocument } from "@/lib/database/query_types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { DocumentThumbnail } from "@/components/ui/media/DocumentThumbnail";
import { DocumentStatusBadge } from "@/components/ui/media/DocumentStatusBadge";
import { EpfHistoryPanel } from "@/components/officer/epf/epf_history_panel";
import { findDocumentType } from "@/lib/document/document_types";
import { categoryForTypeCode } from "@/lib/document/document_categories";
import { useT } from "@/components/i18n/language_provider";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return formatShortThaiDateTh(date);
}

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
  const def = findDocumentType(typeCode);
  const labelEn = def?.labelEn ?? typeCode;
  const category = categoryForTypeCode(typeCode);

  const [title, setTitle] = useState(doc?.title || labelEn);
  const [description, setDescription] = useState(doc?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

  if (!open) return null;

  async function handleSave() {
    if (!doc) return;
    setSaving(true);
    setSaveState("idle");
    try {
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || null }),
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

  return (
    <Drawer open={open} onClose={onClose} titleId="epf-detail-title" title={t("epf.detailTitle")}>
      <div className="space-y-5">
        <div className="flex justify-center rounded-lg bg-neutral-bg p-4">
          <DocumentThumbnail fileUrl={doc?.fileUrl} mimeType={doc?.mimeType} documentTypeCode={typeCode} size="md" altText={labelEn} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <DocumentStatusBadge doc={doc} />
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {t("epf.cardAiReady")}
          </span>
        </div>

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

        <section aria-labelledby="epf-detail-ai-heading" className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <h3 id="epf-detail-ai-heading" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-muted" aria-hidden="true" />
            {t("epf.detailAiHeading")}
          </h3>
          <p className="text-xs text-muted">{t("epf.detailAiComingSoon")}</p>
        </section>
      </div>
    </Drawer>
  );
}
