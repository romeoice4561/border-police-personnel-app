/**
 * CicPriorityMatrix (Phase 49B — Commander Intelligence Center).
 *
 * Renders the four priority buckets (Critical / High / Medium / Normal)
 * exactly as computed by the existing Commander Intelligence engine
 * (OfficerIntelligenceCard.priority, lib/intelligence/dashboard.ts) — this
 * component performs no scoring of its own, only groups/counts the
 * already-assigned priority per officer (see build_view_model.ts's
 * buildPriorityMatrix). Each bucket links to Commander Search pre-filtered
 * by that exact priority value.
 */
"use client";

import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import type { PriorityMatrixBucket, PriorityBucketKey } from "@/lib/commander_intelligence_center/types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const BUCKET_LABEL_KEY: Record<PriorityBucketKey, TranslationKey> = {
  critical: "cic.priority.critical",
  high: "cic.priority.high",
  medium: "cic.priority.medium",
  low: "cic.priority.low",
};

const BUCKET_TONE: Record<PriorityBucketKey, "critical" | "warning" | "accent" | "default"> = {
  critical: "critical",
  high: "warning",
  medium: "accent",
  low: "default",
};

const BUCKET_WRAP_CLASS: Record<PriorityBucketKey, string> = {
  critical: "border-critical/30 bg-critical-bg/40",
  high: "border-warning/30 bg-warning-bg/40",
  medium: "border-accent/30 bg-accent/5",
  low: "border-border bg-neutral-bg/40",
};

function MatrixColumn({ bucket }: { bucket: PriorityMatrixBucket }) {
  const { t } = useT();
  return (
    <Link
      href={bucket.href}
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        BUCKET_WRAP_CLASS[bucket.key]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone={BUCKET_TONE[bucket.key]}>{t(BUCKET_LABEL_KEY[bucket.key])}</Badge>
        <span className="text-2xl font-semibold tabular-nums text-foreground">{bucket.count.toLocaleString()}</span>
      </div>
      {bucket.officers.length === 0 ? (
        <p className="text-xs text-muted">{t("cic.priorityMatrix.empty")}</p>
      ) : (
        <ul className="space-y-1">
          {bucket.officers.slice(0, 5).map((officer) => (
            <li key={officer.officerId} className="truncate text-xs text-foreground/90">
              {officer.displayName}
            </li>
          ))}
        </ul>
      )}
      {bucket.count > 5 ? <span className="text-xs font-medium text-accent">{t("cic.priorityMatrix.viewAll")}</span> : null}
    </Link>
  );
}

export function CicPriorityMatrix({ buckets }: { buckets: PriorityMatrixBucket[] }) {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("cic.priorityMatrix.title")}</CardTitle>
        <p className="mt-1 text-xs text-muted">{t("cic.priorityMatrix.description")}</p>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {buckets.map((bucket) => (
            <MatrixColumn key={bucket.key} bucket={bucket} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
