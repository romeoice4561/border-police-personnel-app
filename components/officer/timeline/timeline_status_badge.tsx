/**
 * TimelineStatusBadge (Phase 45 — Timeline Workspace UX, Part 5/7).
 *
 * Shows a single Timeline card's save status — Draft / Saving / Saved / Error
 * — derived from REAL save signals (see lib/officer_profile/timeline_ux
 * deriveCardStatus). Token colors only (light + dark safe). Presentational.
 */
"use client";

import { Loader2 } from "lucide-react";
import type { TimelineCardStatus } from "@/lib/officer_profile/timeline_ux";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_META: Record<TimelineCardStatus, { tone: NonNullable<BadgeProps["tone"]>; labelKey: TranslationKey; spin?: boolean }> = {
  draft: { tone: "neutral", labelKey: "timeline.statusDraft" },
  saving: { tone: "accent", labelKey: "timeline.statusSaving", spin: true },
  saved: { tone: "good", labelKey: "timeline.statusSaved" },
  error: { tone: "critical", labelKey: "timeline.statusError" },
};

export function TimelineStatusBadge({ status }: { status: TimelineCardStatus }) {
  const { t } = useT();
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      {meta.spin ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
      {t(meta.labelKey)}
    </Badge>
  );
}
