/**
 * EpfCompletenessCard (Phase 46A — Electronic Personnel File Intelligence
 * Dashboard).
 *
 * Completion % + accessible progress bar over the recommended checklist
 * (lib/document/epf_intelligence.ts's computeCompleteness). No database
 * fields added — everything derives from documents already loaded plus the
 * already-resolved officer portrait.
 */
"use client";

import type { CompletenessResult } from "@/lib/document/epf_intelligence";
import { useT } from "@/components/i18n/language_provider";

export function EpfCompletenessCard({ completeness }: { completeness: CompletenessResult }) {
  const { t } = useT();

  return (
    <section aria-labelledby="epf-completeness-heading" className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">
      <div className="flex items-center justify-between">
        <h3 id="epf-completeness-heading" className="text-sm font-semibold text-foreground">
          {t("epf.completeness.title")}
        </h3>
        <span className="text-lg font-semibold tabular-nums text-foreground">{completeness.percent}%</span>
      </div>

      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-bg"
        role="progressbar"
        aria-label={t("epf.completeness.progressLabel")}
        aria-valuenow={completeness.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completeness.percent}%` }} />
      </div>

      <p className="mt-2 text-xs text-muted">
        {completeness.presentCount}/{completeness.totalCount} — {t("epf.completeness.present")}
      </p>
    </section>
  );
}
