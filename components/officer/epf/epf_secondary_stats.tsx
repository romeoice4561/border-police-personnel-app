/**
 * EpfSecondaryStats (Phase 46C — replaces EpfKpiDashboard, which repeated
 * Completion/Storage/Document-count/Missing/Latest-Upload already shown in
 * the Hero and File Health card). This grid shows only INFORMATION NOT
 * DISPLAYED ELSEWHERE: categories used, largest file, and the image/PDF/
 * other file-type breakdown (from the existing StorageSummary — computed
 * once by lib/document/epf_intelligence.ts, never recomputed here).
 */
"use client";

import { LayoutGrid, FileWarning, Image as ImageIcon, FileText, File } from "lucide-react";
import type { EpfDashboardStats, StorageSummary } from "@/lib/document/epf_intelligence";
import { getDocumentTypeLabel } from "@/lib/document/document_type_labels";
import { useLanguage, useT } from "@/components/i18n/language_provider";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  explain,
}: {
  icon: typeof LayoutGrid;
  label: string;
  value: string;
  /** Optional clarifying text (spec §8) — shown as a native tooltip when this figure could otherwise be misread against another visible number with a different denominator. */
  explain?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4" title={explain}>
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function EpfSecondaryStats({ stats, storage }: { stats: EpfDashboardStats; storage: StorageSummary }) {
  const { t } = useT();
  const { language } = useLanguage();
  const largestLabel = stats.largestDocument
    ? getDocumentTypeLabel(stats.largestDocument.documentType, language)
    : t("epf.dashboard.none");

  const totalCount = storage.imageCount + storage.pdfCount + storage.otherCount;
  const distributionSegments = [
    { count: storage.imageCount, className: "bg-accent" },
    { count: storage.pdfCount, className: "bg-good" },
    { count: storage.otherCount, className: "bg-warning" },
  ];

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={LayoutGrid}
          label={t("epf.dashboard.categoriesUsed")}
          value={`${stats.categoriesUsed}/${stats.categoriesTotal}`}
          explain={t("epf.dashboard.categoriesUsedExplain")}
        />
        <StatCard icon={FileWarning} label={t("epf.dashboard.largestFile")} value={largestLabel} />
        <StatCard icon={ImageIcon} label={t("epf.storage.images")} value={String(storage.imageCount)} />
        <StatCard icon={FileText} label={t("epf.storage.pdfs")} value={String(storage.pdfCount)} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">
        <div className="flex items-center gap-2 text-muted">
          <File className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wide">{t("epf.storage.title")}</span>
        </div>
        <div
          className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-bg"
          role="img"
          aria-label={`${t("epf.storage.images")}: ${storage.imageCount}, ${t("epf.storage.pdfs")}: ${storage.pdfCount}, ${t("epf.storage.other")}: ${storage.otherCount}`}
        >
          {totalCount > 0
            ? distributionSegments.map((seg, i) =>
                seg.count > 0 ? <div key={i} className={`h-full ${seg.className}`} style={{ width: `${(seg.count / totalCount) * 100}%` }} /> : null
              )
            : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> {t("epf.storage.images")} ({storage.imageCount})</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-good" /> {t("epf.storage.pdfs")} ({storage.pdfCount})</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> {t("epf.storage.other")} ({storage.otherCount})</span>
          <span className="ml-auto">{formatFileSize(storage.totalBytes)}</span>
        </div>
      </div>
    </div>
  );
}
