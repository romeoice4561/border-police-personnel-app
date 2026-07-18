/**
 * DashboardTrainingOverview (Phase 45 completion pass, Task 6).
 *
 * A compact Training Intelligence overview using existing TrainingSummary
 * aggregation (CommanderDashboardViewModel.training) — no calculation
 * happens here. Every card here reflects a genuinely computable metric;
 * none is fabricated. Visually secondary to Promotion Intelligence — a
 * smaller card grid, placed after it in reading order (see app/dashboard/page.tsx).
 *
 * `hasDataCount` (officers with at least one training record) is derived as
 * `totalPersonnel - noDataCount` — a plain subtraction of two
 * already-computed truthful counts, not a new calculation. Every card
 * except "นโยบายหลักสูตรยังไม่กำหนด" (informational, no drill-down target)
 * supports click-through to a real Commander Search training filter.
 */
"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, FileWarning, GraduationCap, HelpCircle, ShieldAlert } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/workspace/kpi_card";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import type { TrainingStatus } from "@/lib/intelligence/training/types";

const ICON_CLASS = "h-4 w-4";

export function DashboardTrainingOverview({
  training,
  totalPersonnel,
}: {
  training: CommanderDashboardViewModel["training"];
  totalPersonnel: number;
}) {
  const { t } = useT();
  const router = useRouter();

  function goTo(status: TrainingStatus) {
    router.push(`/commander-search?trainingStatus=${status}`);
  }

  const hasDataCount = Math.max(0, totalPersonnel - training.noDataCount);

  return (
    <section aria-label={t("dashboard.trainingOverviewTitle")} className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{t("dashboard.trainingOverviewTitle")}</h2>
      <KpiGrid className="lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label={t("dashboard.trainingHasDataCount")}
          value={hasDataCount.toLocaleString()}
          icon={<CheckCircle2 className={ICON_CLASS} />}
          onClick={hasDataCount > 0 ? () => goTo("Complete") : undefined}
        />
        <KpiCard
          label={t("dashboard.trainingNoDataCount")}
          value={training.noDataCount.toLocaleString()}
          icon={<HelpCircle className={ICON_CLASS} />}
          tone={training.noDataCount > 0 ? "warning" : "neutral"}
          onClick={training.noDataCount > 0 ? () => goTo("NoData") : undefined}
        />
        <KpiCard
          label={t("dashboard.trainingDataIssueCount")}
          value={training.unverifiedCount.toLocaleString()}
          icon={<FileWarning className={ICON_CLASS} />}
          tone={training.unverifiedCount > 0 ? "warning" : "neutral"}
          onClick={training.unverifiedCount > 0 ? () => goTo("Unverified") : undefined}
        />
        {training.policyConfigured ? (
          <KpiCard
            label={t("dashboard.trainingMissingRequiredCount")}
            value={training.missingRequiredCount.toLocaleString()}
            icon={<ShieldAlert className={ICON_CLASS} />}
            tone={training.missingRequiredCount > 0 ? "warning" : "neutral"}
            onClick={() => goTo("MissingRequired")}
          />
        ) : (
          // Task 6: policy-not-configured is an explicit unavailable-style
          // state, not a fabricated zero — no drill-down (nothing real to filter to).
          <KpiCard
            label={t("dashboard.trainingPolicyNotSetCount")}
            value={t("dashboard.trainingNoPolicy")}
            icon={<GraduationCap className={ICON_CLASS} />}
          />
        )}
      </KpiGrid>
    </section>
  );
}
