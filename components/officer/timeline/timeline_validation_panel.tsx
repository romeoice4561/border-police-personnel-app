/**
 * TimelineValidationPanel (Phase 45 — Timeline Workspace UX, Part 8/9).
 *
 * Renders the non-blocking advisory warnings from
 * lib/officer_profile/timeline_ux::deriveTimelineWarnings (duplicate current
 * position / year order / overlapping years / missing fields). ADVISORY ONLY —
 * it never blocks saving; it just surfaces things a non-technical user may want
 * to review. Renders nothing when there are no warnings. Token colors (warning)
 * work in light + dark.
 */
"use client";

import { AlertTriangle } from "lucide-react";
import type { TimelineWarning, TimelineWarningCode } from "@/lib/officer_profile/timeline_ux";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const WARNING_LABEL_KEY: Record<TimelineWarningCode, TranslationKey> = {
  MULTIPLE_CURRENT: "timeline.warnMultipleCurrent",
  YEAR_ORDER: "timeline.warnYearOrder",
  OVERLAPPING_PERIOD: "timeline.warnOverlapping",
  MISSING_FIELDS: "timeline.warnMissingFields",
};

export function TimelineValidationPanel({ warnings }: { warnings: TimelineWarning[] }) {
  const { t } = useT();
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning/40 bg-warning-bg/50 p-3" role="status" aria-live="polite">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warning">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {t("timeline.warningsTitle")}
      </p>
      <ul className="space-y-0.5 pl-5">
        {warnings.map((w) => (
          <li key={w.code} className="list-disc text-xs text-foreground">
            {t(WARNING_LABEL_KEY[w.code])}
          </li>
        ))}
      </ul>
    </div>
  );
}
