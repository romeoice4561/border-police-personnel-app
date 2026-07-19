"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { FlagBadge, PriorityBadge, PromotionStatusBadge, RetirementStatusBadge } from "@/components/intelligence/intelligence_badge";
import { COMPLETENESS_BAND_KEY, translationKeyForRecommendation } from "@/lib/intelligence/commander_intelligence_copy";
import { useT } from "@/components/i18n/language_provider";
import type { OfficerIntelligenceCard as OfficerIntelligenceCardData } from "@/lib/intelligence";

export function OfficerIntelligenceCard({ card }: { card: OfficerIntelligenceCardData }) {
  const { t } = useT();
  const topRecommendations = card.recommendations.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("commander.intelligence.title")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <PromotionStatusBadge status={card.promotionStatus} />
          <RetirementStatusBadge status={card.retirementStatus} />
          <PriorityBadge priority={card.priority} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{t("commander.intelligence.profileCompletion")}</span>
            <span className="tabular-nums text-muted">
              {card.profileCompletenessPercent ?? "—"}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-bg">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${card.profileCompletenessPercent ?? 0}%` }}
              aria-hidden="true"
            />
          </div>
          <p className="text-xs text-muted">
            {t("commander.intelligence.completenessSummaryPrefix")} {t(COMPLETENESS_BAND_KEY[card.profileCompleteness])} · {t("commander.intelligence.priorityScoreLabel")}: {card.priorityScore}
          </p>
        </div>

        {card.flags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {card.flags.map((flag) => (
              <FlagBadge key={flag.code} flag={flag} />
            ))}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("commander.intelligence.recommendations")}</p>
          {topRecommendations.length > 0 ? (
            <ul className="space-y-1 text-sm text-foreground">
              {topRecommendations.map((item) => {
                const key = translationKeyForRecommendation(item);
                return (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <span>{key ? t(key) : item}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("commander.intelligence.noRecommendations")}</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
