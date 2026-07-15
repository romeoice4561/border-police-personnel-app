/**
 * TimelineHeader (Phase 45 — Timeline Workspace UX, Part 1/2/10).
 *
 * The always-visible header of a Timeline card — shown whether the card is
 * expanded or collapsed, so a user can scan/identify each record without
 * opening it (reduces editing the wrong entry). Displays:
 *   • Timeline #N  (N / total)
 *   • start date summary
 *   • position summary
 *   • unit summary
 *   • current-position badge (green) when this is the current entry
 *   • the per-card save status badge
 *   • the collapse/expand toggle
 *
 * Presentational only. Colors come from design tokens (light + dark safe).
 */
"use client";

import { CircleDot } from "lucide-react";
import type { TimelineCardStatus } from "@/lib/officer_profile/timeline_ux";
import { useT } from "@/components/i18n/language_provider";
import { Badge } from "@/components/ui/badge";
import { TimelineStatusBadge } from "@/components/officer/timeline/timeline_status_badge";
import { TimelineCollapse } from "@/components/officer/timeline/timeline_collapse";

export interface TimelineHeaderProps {
  index: number;
  total: number;
  dateSummary: string;
  positionSummary: string;
  unitSummary: string;
  isPresent: boolean;
  status: TimelineCardStatus;
  expanded: boolean;
  bodyId: string;
  onToggle: () => void;
}

export function TimelineHeader({
  index,
  total,
  dateSummary,
  positionSummary,
  unitSummary,
  isPresent,
  status,
  expanded,
  bodyId,
  onToggle,
}: TimelineHeaderProps) {
  const { t } = useT();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Accent Timeline number (Part 1). */}
          <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
            {t("timeline.entry")} #{index + 1}
          </span>
          <span className="text-xs text-muted tabular-nums">
            {index + 1} / {total}
          </span>
          {isPresent ? (
            <Badge tone="good">
              <CircleDot className="h-3 w-3" aria-hidden="true" />
              {t("timeline.currentPosition")}
            </Badge>
          ) : null}
        </div>

        {/* Summary lines — always visible, even when collapsed. */}
        <p className="wrap-break-word text-sm font-semibold text-foreground">{dateSummary}</p>
        <p className="wrap-break-word text-sm text-foreground">{positionSummary}</p>
        <p className="wrap-break-word text-xs text-muted">{unitSummary}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <TimelineStatusBadge status={status} />
        <TimelineCollapse expanded={expanded} forcedOpen={isPresent} controls={bodyId} onToggle={onToggle} />
      </div>
    </div>
  );
}
