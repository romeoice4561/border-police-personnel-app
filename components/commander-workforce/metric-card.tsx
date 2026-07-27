/**
 * Executive metric tile — dominant number, quieter label (Phase 52.2.1).
 * Unavailable metrics show availability state, never a fabricated zero.
 */
import type { ReactNode } from "react";
import type { MetricAvailability, WorkforceDrilldownDescriptor } from "@/lib/commander_workforce/types";
import { AvailabilityState } from "@/components/commander-workforce/availability-state";
import { DrilldownLink } from "@/components/commander-workforce/drilldown-link";
import { sanitizeExecutiveCopy } from "@/components/commander-workforce/labels";
import { Card, CardBody } from "@/components/ui/card";
import type { StatusTone } from "@/lib/ui/quality";
import { cn } from "@/lib/ui/cn";

/** Overview → accent (blue family per theme); positive → good; attention → warning; critical → critical. */
export type ExecutiveMetricTone = StatusTone | "overview";

const VALUE_TONE: Record<ExecutiveMetricTone, string> = {
  overview: "text-accent",
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  critical: "text-critical",
  neutral: "text-foreground",
};

const BORDER_TONE: Record<ExecutiveMetricTone, string> = {
  overview: "border-accent/25",
  good: "border-good/25",
  warning: "border-warning/30",
  serious: "border-serious/30",
  critical: "border-critical/30",
  neutral: "border-border",
};

export function MetricCard({
  labelTh,
  count,
  percentage,
  availability,
  drilldown,
  descriptionTh,
  tone = "neutral",
  badge,
}: {
  labelTh: string;
  count: number;
  percentage?: number | null;
  availability: MetricAvailability;
  drilldown?: WorkforceDrilldownDescriptor | null;
  descriptionTh?: string;
  tone?: ExecutiveMetricTone;
  badge?: ReactNode;
}) {
  const safeHint = descriptionTh ? sanitizeExecutiveCopy(descriptionTh) : null;
  const hintParts = [percentage != null ? `${percentage}%` : null, safeHint].filter(Boolean);

  const body = (
    <Card className={cn("h-full", BORDER_TONE[tone])}>
      <CardBody className="flex h-full flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          {availability.status === "unavailable" ? (
            <p className={cn("text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl", "text-muted")}>—</p>
          ) : (
            <p className={cn("text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl", VALUE_TONE[tone])}>
              {count.toLocaleString("th-TH")}
            </p>
          )}
          {badge ? <div className="shrink-0 pt-0.5">{badge}</div> : null}
        </div>
        <p className="text-[11px] font-medium leading-snug text-muted sm:text-xs">{labelTh}</p>
        {availability.status === "unavailable" ? (
          <AvailabilityState availability={availability} className="mt-auto" />
        ) : hintParts.length ? (
          <p className="mt-auto line-clamp-2 text-[11px] leading-snug text-muted/90">{hintParts.join(" · ")}</p>
        ) : null}
      </CardBody>
    </Card>
  );

  if (availability.status === "unavailable" || !drilldown?.relativeHref) return body;
  return <DrilldownLink drilldown={drilldown}>{body}</DrilldownLink>;
}
