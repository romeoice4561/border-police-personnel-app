/**
 * EpfHeroSummary (Phase 46B — Executive UX & Intelligence Polish;
 * Phase 46C — the SOLE authoritative location for completion %, document
 * count, storage used, and last update — every other card in the e-PF must
 * show DIFFERENT information, never repeat these four values. The
 * Healthy/Needs Attention/Incomplete verdict is also shown here, once,
 * directly under the progress bar).
 *
 * Every value is read straight from the already-computed Phase 46A/46B
 * results (CompletenessResult / EpfDashboardStats / FileHealth) — nothing is
 * recalculated here.
 */
"use client";

import type { CompletenessResult, EpfDashboardStats } from "@/lib/document/epf_intelligence";
import type { FileHealth, FileHealthLevel } from "@/lib/document/epf_insights";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LEVEL_META: Record<FileHealthLevel, { tone: "good" | "warning" | "serious"; labelKey: TranslationKey }> = {
  healthy: { tone: "good", labelKey: "epf.health.healthy" },
  needs_attention: { tone: "warning", labelKey: "epf.health.needsAttention" },
  incomplete: { tone: "serious", labelKey: "epf.health.incomplete" },
};

export function EpfHeroSummary({
  stats,
  completeness,
  health,
}: {
  stats: EpfDashboardStats;
  completeness: CompletenessResult;
  health: FileHealth;
}) {
  const { t } = useT();
  const lastUpdated = stats.mostRecentDocument?.uploadedAt ? formatShortThaiDateTh(new Date(stats.mostRecentDocument.uploadedAt)) : null;
  const levelMeta = LEVEL_META[health.level];

  return (
    <div className="rounded-2xl border border-border bg-neutral-bg p-5 sm:p-6">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{t("epf.hero.title")}</p>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium text-muted">{t("epf.hero.fileHealth")}</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums text-foreground">{completeness.percent}%</p>
          <div
            className="mt-3 h-2.5 w-56 max-w-full overflow-hidden rounded-full bg-border/60"
            role="progressbar"
            aria-label={t("epf.completeness.progressLabel")}
            aria-valuenow={completeness.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completeness.percent}%` }} />
          </div>
          <Badge tone={levelMeta.tone} className="mt-2">
            {t(levelMeta.labelKey)}
          </Badge>
        </div>

        <dl className="grid grid-cols-3 gap-4 sm:gap-8">
          <div>
            <dt className="text-xs text-muted">{t("epf.hero.documentCount")}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{stats.totalDocuments}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("epf.hero.storageUsed")}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{formatFileSize(stats.totalStorageBytes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("epf.hero.lastUpdated")}</dt>
            <dd className="mt-0.5 text-xl font-semibold text-foreground">{lastUpdated ?? t("epf.dashboard.none")}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
