/**
 * EpfCategoryGroup (Phase 46 — Electronic Personnel File Foundation;
 * Phase 46A — adds the category dashboard row: count/storage/last-updated/
 * mini completion indicator, and Expand All/Collapse All control from the
 * parent via a controlled `expanded` prop; Phase 46B — an empty category
 * (no documents uploaded for any type in it, but not filtered out by the
 * user's search/filter) shows short per-category guidance + an Upload
 * action instead of just an empty list, per spec §7/§9).
 *
 * One collapsible category section of the e-PF document center: icon,
 * title, document count, storage, last-updated, completion, and its list of
 * EpfDocumentCard rows. Reuses TimelineCollapse
 * (components/officer/timeline/timeline_collapse.tsx) for the expand/
 * collapse control instead of inventing a new one — same accessible
 * button/aria-expanded/aria-controls pattern already proven elsewhere in the
 * Officer Profile.
 */
"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { Upload } from "lucide-react";
import type { OfficerDocument } from "@/lib/database/query_types";
import type { DocumentCategoryDefinition } from "@/lib/document/document_categories";
import type { CategoryRollup } from "@/lib/document/epf_intelligence";
import { TimelineCollapse } from "@/components/officer/timeline/timeline_collapse";
import { EpfDocumentCard } from "@/components/officer/epf/epf_document_card";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EpfCategoryGroup({
  category,
  icon: Icon,
  officerId,
  rows,
  rollup,
  onRefresh,
  onOpenDetails,
  onOpenHistory,
  expanded,
  onToggle,
}: {
  category: DocumentCategoryDefinition;
  icon: LucideIcon;
  officerId: string;
  rows: Array<{ code: string; doc: OfficerDocument | null }>;
  rollup: CategoryRollup;
  onRefresh: () => void;
  onOpenDetails: (typeCode: string) => void;
  onOpenHistory: (typeCode: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useT();
  const panelId = useId();
  const uploadedCount = rows.filter((r) => r.doc).length;
  const isEmpty = uploadedCount === 0;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:px-4">
        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <p className="min-w-0 shrink-0 text-sm font-semibold text-foreground">{t(`epf.category.${category.code}` as TranslationKey)}</p>

        <span className="shrink-0 text-xs tabular-nums text-muted">
          {uploadedCount}/{rows.length}
        </span>
        <span className="shrink-0 text-xs text-muted">
          {rollup.totalBytes > 0 ? formatFileSize(rollup.totalBytes) : t("epf.dashboard.none")}
        </span>
        <span className="shrink-0 text-xs text-muted">
          {rollup.lastUpdated ? formatShortThaiDateTh(rollup.lastUpdated) : t("epf.categoryDashboard.noUpdates")}
        </span>
        {rollup.totalCount > 0 ? (
          <span
            role="progressbar"
            aria-label={`${t(`epf.category.${category.code}` as TranslationKey)} ${t("epf.completeness.title")}`}
            aria-valuenow={rollup.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted"
          >
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-bg">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${rollup.percent}%` }} />
            </span>
            {rollup.percent}%
          </span>
        ) : null}

        <span className="ml-auto shrink-0">
          <TimelineCollapse expanded={expanded} controls={panelId} onToggle={onToggle} />
        </span>
      </div>

      {expanded ? (
        isEmpty ? (
          <div id={panelId} className="flex flex-col items-center gap-2 border-t border-border px-4 py-6 text-center">
            <p className="text-xs text-muted">
              {t(`epf.category.${category.code}` as TranslationKey)} — {t("epf.categoryEmptyState")}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenDetails(rows[0].code)}>
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {t("epf.categoryEmptyUpload")}
            </Button>
          </div>
        ) : (
          <ul id={panelId} className="space-y-2.5 border-t border-border p-2.5 sm:p-3">
            {rows.map((row) => (
              <EpfDocumentCard
                key={row.code}
                officerId={officerId}
                typeCode={row.code}
                doc={row.doc}
                onRefresh={onRefresh}
                onOpenDetails={() => onOpenDetails(row.code)}
                onOpenHistory={() => onOpenHistory(row.code)}
              />
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
