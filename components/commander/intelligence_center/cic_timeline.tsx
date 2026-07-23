/**
 * CicTimeline (Phase 49B — Commander Intelligence Center).
 *
 * Renders upcoming events (birthdays, retirement, promotion eligibility,
 * document/training expiry) bucketed into 30/60/90-day windows — every
 * event was already computed by build_view_model.ts from existing Age/
 * Retirement/Promotion/Document-Expiry Intelligence outputs; this
 * component only lists and links them.
 */
"use client";

import Link from "next/link";
import { Cake, Award, IdCard, GraduationCap, LogOut } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderTimelineBucket, CommanderTimelineEventKind, CommanderTimelineHorizon } from "@/lib/commander_intelligence_center/types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const HORIZON_LABEL_KEY: Record<CommanderTimelineHorizon, TranslationKey> = {
  30: "cic.timeline.next30",
  60: "cic.timeline.next60",
  90: "cic.timeline.next90",
};

const KIND_LABEL_KEY: Record<CommanderTimelineEventKind, TranslationKey> = {
  birthday: "cic.timeline.kind.birthday",
  retirement: "cic.timeline.kind.retirement",
  promotionEligibility: "cic.timeline.kind.promotionEligibility",
  documentExpiry: "cic.timeline.kind.documentExpiry",
  trainingExpiry: "cic.timeline.kind.trainingExpiry",
};

const KIND_ICON: Record<CommanderTimelineEventKind, typeof Cake> = {
  birthday: Cake,
  retirement: LogOut,
  promotionEligibility: Award,
  documentExpiry: IdCard,
  trainingExpiry: GraduationCap,
};

function TimelineColumn({ bucket }: { bucket: CommanderTimelineBucket }) {
  const { t } = useT();
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{t(HORIZON_LABEL_KEY[bucket.horizon])}</h3>
      <ul className="space-y-1.5">
        {bucket.events.map((event, index) => {
          const Icon = KIND_ICON[event.kind];
          const daysText = event.daysUntil === 0 ? t("cic.timeline.today") : `${t("cic.timeline.daysUntilPrefixTh")} ${event.daysUntil} ${t("cic.timeline.daysUntilSuffixTh")}`;
          return (
            <li key={`${event.kind}-${event.officerId}-${index}`}>
              <Link
                href={event.href}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{event.displayName}</span>
                  <span className="block text-muted">
                    {t(KIND_LABEL_KEY[event.kind])} · {event.detailTh} · {daysText}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CicTimeline({ buckets }: { buckets: CommanderTimelineBucket[] }) {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("cic.timeline.title")}</CardTitle>
        <p className="mt-1 text-xs text-muted">{t("cic.timeline.description")}</p>
      </CardHeader>
      <CardBody>
        {buckets.length === 0 ? (
          <p className="text-sm text-muted">{t("cic.timeline.empty")}</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            {buckets.map((bucket) => (
              <TimelineColumn key={bucket.horizon} bucket={bucket} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
