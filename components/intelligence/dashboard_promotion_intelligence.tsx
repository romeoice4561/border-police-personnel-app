/**
 * DashboardPromotionIntelligence (Phase 42 — Commander Dashboard
 * Intelligence, Task 3).
 *
 * The Promotion Intelligence KPI section. Every count is read directly from
 * PromotionSummary.promotionStatus counts already computed by
 * lib/commander_dashboard/view_model.ts — this component does not
 * recalculate promotion eligibility. A zero-count card is rendered in a
 * subdued (neutral) tone rather than an alert tone, and its hint states
 * plainly that the blocker is not yet configured by policy (Task 3's
 * "truthful zero, not urgent" rule) rather than hiding the card.
 */
"use client";

import { useRouter } from "next/navigation";
import { Award, Clock, FileWarning, GraduationCap, HelpCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/workspace/kpi_card";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";

const ICON_CLASS = "h-4 w-4";

export function DashboardPromotionIntelligence({ promotion }: { promotion: CommanderDashboardViewModel["promotion"] }) {
  const { t } = useT();
  const router = useRouter();

  function goTo(status: PromotionEligibilityStatus) {
    router.push(`/commander-search?promotionEligibilityStatus=${status}`);
  }

  const cards: Array<{ status: PromotionEligibilityStatus; label: string; value: number; icon: typeof Award; alertWhenPositive: boolean }> = [
    { status: "EligibleThisYear", label: t("dashboard.promotionEligibleThisYear"), value: promotion.eligibleThisYear, icon: Award, alertWhenPositive: false },
    { status: "AlreadyEligible", label: t("dashboard.promotionAlreadyEligible"), value: promotion.alreadyEligible, icon: ShieldAlert, alertWhenPositive: true },
    { status: "Waiting", label: t("dashboard.promotionWaiting"), value: promotion.waiting, icon: Clock, alertWhenPositive: false },
    { status: "MissingTraining", label: t("dashboard.promotionMissingTraining"), value: promotion.missingTraining, icon: GraduationCap, alertWhenPositive: true },
    { status: "MissingDocuments", label: t("dashboard.promotionMissingDocuments"), value: promotion.missingDocuments, icon: FileWarning, alertWhenPositive: true },
    { status: "RetirementRestricted", label: t("dashboard.promotionRetirementRestricted"), value: promotion.retirementRestricted, icon: ShieldCheck, alertWhenPositive: true },
    { status: "Unknown", label: t("dashboard.promotionUnknown"), value: promotion.unknown, icon: HelpCircle, alertWhenPositive: false },
  ];

  return (
    <section aria-label={t("dashboard.promotionIntelligenceTitle")} className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{t("dashboard.promotionIntelligenceTitle")}</h2>
      <KpiGrid className="lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <KpiCard
            key={card.status}
            label={card.label}
            value={card.value.toLocaleString()}
            icon={<card.icon className={ICON_CLASS} />}
            tone={card.value > 0 && card.alertWhenPositive ? "warning" : "neutral"}
            hint={card.value === 0 ? t("dashboard.promotionZeroHint") : undefined}
            onClick={() => goTo(card.status)}
          />
        ))}
      </KpiGrid>
    </section>
  );
}
