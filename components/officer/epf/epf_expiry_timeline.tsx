/**
 * EpfExpiryTimeline (Phase 47 — Document Expiry Intelligence).
 *
 * Compact timeline grouped Expired/Next 30/Next 60/Next 90/Later/Unknown —
 * a direct render of lib/document/document_expiry.ts's
 * groupByTimelineBucket output (already sorted by urgency). No status is
 * ever computed here — this component only reads DocumentExpiryInfo.
 */
"use client";

import { AlertTriangle, XCircle, HelpCircle, Clock } from "lucide-react";
import type { TimelineBucket, TimelineBucketKey, ExpiryStatus } from "@/lib/document/document_expiry";
import { EXPIRY_STATUS_TONE } from "@/lib/document/document_expiry";
import { findDocumentType } from "@/lib/document/document_types";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const BUCKET_LABEL_KEY: Record<TimelineBucketKey, TranslationKey> = {
  expired: "epf.expiry.groupExpired",
  next30: "epf.expiry.groupNext30",
  next60: "epf.expiry.groupNext60",
  next90: "epf.expiry.groupNext90",
  later: "epf.expiry.groupLater",
  unknown: "epf.expiry.groupUnknown",
};

const STATUS_LABEL_KEY: Record<ExpiryStatus, TranslationKey> = {
  valid: "epf.expiry.statusValid",
  expiring_soon: "epf.expiry.statusExpiringSoon",
  expired: "epf.expiry.statusExpired",
  unknown: "epf.expiry.statusUnknown",
};

const BUCKET_ICON: Record<TimelineBucketKey, typeof AlertTriangle> = {
  expired: XCircle,
  next30: AlertTriangle,
  next60: AlertTriangle,
  next90: Clock,
  later: Clock,
  unknown: HelpCircle,
};

export function EpfExpiryTimeline({ buckets }: { buckets: TimelineBucket[] }) {
  const { t } = useT();

  return (
    <section aria-labelledby="epf-expiry-timeline-heading" className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">
      <h3 id="epf-expiry-timeline-heading" className="text-sm font-semibold text-foreground">
        {t("epf.expiry.timelineTitle")}
      </h3>

      {buckets.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{t("epf.expiry.timelineEmpty")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {buckets.map((bucket) => {
            const Icon = BUCKET_ICON[bucket.key];
            return (
              <div key={bucket.key}>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {t(BUCKET_LABEL_KEY[bucket.key])} ({bucket.items.length})
                </p>
                <ul className="space-y-1">
                  {bucket.items.map((item) => {
                    const label = findDocumentType(item.document.documentType)?.labelEn ?? item.document.documentType;
                    return (
                      <li key={item.document.id} className="flex items-center justify-between gap-2 rounded-md bg-neutral-bg px-2.5 py-1.5 text-xs">
                        <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
                        {item.daysRemaining != null ? (
                          <span className="shrink-0 tabular-nums text-muted">
                            {item.daysRemaining < 0
                              ? `${Math.abs(item.daysRemaining)} ${t("epf.expiry.daysOverdue")}`
                              : item.daysRemaining === 0
                                ? t("epf.expiry.today")
                                : `${item.daysRemaining} ${t("epf.expiry.daysUnit")}`}
                          </span>
                        ) : null}
                        <Badge tone={EXPIRY_STATUS_TONE[item.status]} className="shrink-0">
                          {t(STATUS_LABEL_KEY[item.status])}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
