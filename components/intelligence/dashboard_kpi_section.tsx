/**
 * DashboardKpiSection (Phase 48A — Enterprise Workspace Foundation, Dashboard
 * reference implementation).
 *
 * Renders the Dashboard's KPI row using the new shared KpiCard/KpiGrid
 * (components/workspace/kpi_card.tsx) instead of the page-specific
 * CommanderSummaryCards tile — same data (CommanderDashboardSummary), same
 * eight metrics, same icons/labels; only the underlying tile component
 * changed, per this phase's "Dashboard composes the reusable components"
 * requirement. CommanderSummaryCards itself is UNCHANGED and still exported
 * (nothing else in the app was migrated off it this phase).
 */
"use client";

import { AlertTriangle, Award, FileWarning, GraduationCap, IdCard, ImageOff, ShieldCheck, Users } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/workspace/kpi_card";
import type { CommanderDashboardSummary } from "@/lib/intelligence";
import { useT } from "@/components/i18n/language_provider";

export function DashboardKpiSection({ summary }: { summary: CommanderDashboardSummary }) {
  const { t } = useT();
  const iconClass = "h-4 w-4";
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
      <KpiCard label={t("dashboard.missingTraining")} value={summary.missingTraining.toLocaleString()} icon={<GraduationCap className={iconClass} />} />
    </KpiGrid>
  );
}
