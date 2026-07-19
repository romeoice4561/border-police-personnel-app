/**
 * EpfFileHealthCard (Phase 46B — "File Health"; Phase 46C — merged with the
 * old separate Completeness card since they communicated almost identical
 * information. The large completion % + progress bar + Healthy/Needs
 * Attention/Incomplete verdict now live ONLY in EpfHeroSummary — this card
 * shows the DIFFERENT, complementary breakdown: Complete/Missing/Unknown
 * counts and a compact secondary progress indicator, never repeating the
 * headline number as its own giant figure.
 */
"use client";

import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import type { CompletenessResult } from "@/lib/document/epf_intelligence";
import { useT } from "@/components/i18n/language_provider";

export function EpfFileHealthCard({ completeness }: { completeness: CompletenessResult }) {
  const { t } = useT();
  const missingCount = completeness.items.filter((i) => i.state === "missing").length;
  const unknownCount = completeness.items.filter((i) => i.state === "unknown").length;

  return (
    <section aria-labelledby="epf-health-heading" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h3 id="epf-health-heading" className="text-sm font-semibold text-foreground">
        {t("epf.health.title")}
      </h3>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-good" aria-hidden="true" />
          <div>
            <dt className="text-xs text-muted">{t("epf.health.complete")}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{completeness.presentCount}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0 text-serious" aria-hidden="true" />
          <div>
            <dt className="text-xs text-muted">{t("epf.health.missing")}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{missingCount}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <dt className="text-xs text-muted">{t("epf.health.unknown")}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{unknownCount}</dd>
          </div>
        </div>
      </dl>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-bg"
        role="progressbar"
        aria-label={t("epf.completeness.progressLabel")}
        aria-valuenow={completeness.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completeness.percent}%` }} />
      </div>
    </section>
  );
}
