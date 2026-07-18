/**
 * DashboardKpiSection (Phase 48A — Enterprise Workspace Foundation, Dashboard
 * reference implementation; Phase 45 — Training Intelligence Engine wires
 * the "ขาดหลักสูตร" card to real Training Intelligence).
 *
 * Renders the Dashboard's KPI row using the new shared KpiCard/KpiGrid
 * (components/workspace/kpi_card.tsx) instead of the page-specific
 * CommanderSummaryCards tile — same data (CommanderDashboardSummary), same
 * eight metrics, same icons/labels; only the underlying tile component
 * changed, per this phase's "Dashboard composes the reusable components"
 * requirement. CommanderSummaryCards itself is UNCHANGED and still exported
 * (nothing else in the app was migrated off it this phase).
 *
 * Phase 45: the "ขาดหลักสูตร" card previously read
 * `summary.missingTraining` — a LEGACY score-based "has zero training rows
 * at all" flag count (lib/intelligence/flags.ts's NEEDS_TRAINING), unrelated
 * to any real promotion policy. It now reads `training.missingRequiredCount`
 * from the Training Intelligence view model (CommanderDashboardViewModel.training)
 * — truthfully 0 today (no real TrainingPolicy is configured yet) rather
 * than a legacy proxy signal. When no policy exists anywhere,
 * the card shows "ยังไม่ได้กำหนดนโยบาย" instead of a numeric 0 that would
 * misleadingly imply "checked and compliant." Never links to a Commander
 * Search training filter unless `training.policyConfigured` is true.
 */
"use client";

import Link from "next/link";
import { AlertTriangle, Award, FileWarning, GraduationCap, IdCard, ImageOff, ShieldCheck, Users } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/workspace/kpi_card";
import type { CommanderDashboardSummary } from "@/lib/intelligence";
import type { CommanderDashboardViewModel } from "@/lib/commander_dashboard/types";
import { useT } from "@/components/i18n/language_provider";

export function DashboardKpiSection({
  summary,
  training,
}: {
  summary: CommanderDashboardSummary;
  training: CommanderDashboardViewModel["training"];
}) {
  const { t } = useT();
  const iconClass = "h-4 w-4";

  // Task 5: four distinct states — never a misleading zero, never NoPolicy
  // mislabeled as a confirmed evaluation result. State 4 (unavailable) is
  // checked first since it overrides every other state's meaning.
  const trainingCard = training.unavailableCount > 0 ? (
    <KpiCard label={t("dashboard.missingTraining")} value={t("dashboard.trainingUnavailable")} icon={<GraduationCap className={iconClass} />} />
  ) : training.policyConfigured ? (
    // States 1/2: a real policy exists — the count (including a genuine
    // zero) is a real evaluation result and safe to link to a drill-down.
    <Link href="/commander-search?trainingStatus=MissingRequired">
      <KpiCard
        label={t("dashboard.missingTraining")}
        value={training.missingRequiredCount.toLocaleString()}
        tone={training.missingRequiredCount > 0 ? "warning" : "neutral"}
        hint={training.missingRequiredCount === 0 ? t("dashboard.trainingZeroConfirmedHint") : undefined}
        icon={<GraduationCap className={iconClass} />}
      />
    </Link>
  ) : (
    // State 3: no policy configured anywhere — informational, never a
    // fabricated zero, no drill-down link (there is nothing real to filter to).
    <KpiCard
      label={t("dashboard.missingTraining")}
      value={t("dashboard.trainingNoPolicy")}
      hint={t("dashboard.trainingNoPolicyHint")}
      icon={<GraduationCap className={iconClass} />}
    />
  );

  return (
    <KpiGrid>
      <KpiCard label={t("dashboard.totalOfficersKpi")} value={summary.totalOfficers.toLocaleString()} icon={<Users className={iconClass} />} />
      <KpiCard label={t("dashboard.promotionReady")} value={summary.promotionReady.toLocaleString()} icon={<Award className={iconClass} />} />
      <KpiCard label={t("dashboard.nearPromotion")} value={summary.nearPromotion.toLocaleString()} icon={<ShieldCheck className={iconClass} />} />
      <KpiCard
        label={t("dashboard.retiringSoon")}
        value={summary.retiringSoon.toLocaleString()}
        tone={summary.retiringSoon > 0 ? "warning" : "neutral"}
        icon={<AlertTriangle className={iconClass} />}
      />
      <KpiCard
        label={t("dashboard.missingDocs")}
        value={summary.missingDocuments.toLocaleString()}
        tone={summary.missingDocuments > 0 ? "warning" : "neutral"}
        icon={<FileWarning className={iconClass} />}
      />
      <KpiCard label={t("dashboard.missingGp7")} value={summary.missingGp7.toLocaleString()} icon={<IdCard className={iconClass} />} />
      <KpiCard label={t("dashboard.missingPortrait")} value={summary.missingPortrait.toLocaleString()} icon={<ImageOff className={iconClass} />} />
      {trainingCard}
    </KpiGrid>
  );
}
