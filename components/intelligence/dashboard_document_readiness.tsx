/**
 * DashboardDocumentReadiness (Phase 49A — §4).
 *
 * "ความพร้อมด้านเอกสารกำลังพล" — the Commander Dashboard's document-
 * readiness KPI section. Every count comes from
 * lib/integration/commander/document_readiness_dashboard.ts's pure
 * aggregation over CommanderQueryOfficer[] (each officer's
 * documentIntelligence was already computed once by toQueryOfficer.ts) —
 * this component performs no readiness/completeness/expiry calculation
 * itself. Clicking any KPI navigates to Commander Search with the matching
 * URL filter (lib/integration/navigation/drilldown_contract.ts) — never a
 * local-only filter that a reload/bookmark can't reproduce.
 *
 * Zero counts render in a subdued neutral tone (never a warning/serious
 * alarm color for "0" — a 0 count is good news for every one of these
 * KPIs), per spec §4.
 */
"use client";

import { useRouter } from "next/navigation";
import { FileCheck2, FileSearch, FileX2, ShieldAlert, CalendarClock, CalendarX2, ScanLine, FileWarning } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/workspace/kpi_card";
import { useT } from "@/components/i18n/language_provider";
import { buildCommanderDocumentFilterUrl } from "@/lib/integration/navigation/drilldown_contract";
import type { DocumentReadinessDashboardKpis } from "@/lib/integration/commander/document_readiness_dashboard";
import type { StatusTone } from "@/lib/ui/quality";

/** Zero always renders neutral — a 0 count is never alarming for any of these KPIs. Only a real non-zero count earns the tone. */
function toneFor(count: number, nonZeroTone: StatusTone): StatusTone {
  return count > 0 ? nonZeroTone : "neutral";
}

export function DashboardDocumentReadiness({ kpis }: { kpis: DocumentReadinessDashboardKpis | null }) {
  const { t } = useT();
  const router = useRouter();

  if (kpis === null) {
    return (
      <section aria-label={t("dashboard.documentReadinessTitle")} className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.documentReadinessTitle")}</h2>
        <p className="text-sm text-muted">{t("dashboard.documentReadinessUnavailable")}</p>
      </section>
    );
  }

  function goTo(filters: Parameters<typeof buildCommanderDocumentFilterUrl>[0]) {
    router.push(buildCommanderDocumentFilterUrl(filters));
  }

  return (
    <section aria-label={t("dashboard.documentReadinessTitle")} className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.documentReadinessTitle")}</h2>
        <span className="text-xs text-muted">
          {kpis.totalOfficers.toLocaleString()} {t("dashboard.documentReadinessOfOfficers")}
        </span>
      </div>
      <KpiGrid>
        <KpiCard
          label={t("dashboard.documentReadinessReady")}
          value={kpis.readyCount.toLocaleString()}
          icon={<FileCheck2 className="h-4 w-4" />}
          tone={toneFor(kpis.readyCount, "good")}
          onClick={() => goTo({ documentReadiness: "READY" })}
        />
        <KpiCard
          label={t("dashboard.documentReadinessNeedsReview")}
          value={kpis.needsReviewCount.toLocaleString()}
          icon={<FileSearch className="h-4 w-4" />}
          tone={toneFor(kpis.needsReviewCount, "warning")}
          onClick={() => goTo({ documentReadiness: "NEEDS_REVIEW" })}
        />
        <KpiCard
          label={t("dashboard.documentReadinessIncomplete")}
          value={kpis.incompleteCount.toLocaleString()}
          icon={<FileX2 className="h-4 w-4" />}
          tone={toneFor(kpis.incompleteCount, "warning")}
          onClick={() => goTo({ documentReadiness: "INCOMPLETE" })}
        />
        <KpiCard
          label={t("dashboard.documentReadinessBlocked")}
          value={kpis.blockedCount.toLocaleString()}
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={toneFor(kpis.blockedCount, "serious")}
          onClick={() => goTo({ documentReadiness: "BLOCKED" })}
        />
        <KpiCard
          label={t("dashboard.documentReadinessExpiringSoon")}
          value={kpis.expiringSoonCount.toLocaleString()}
          icon={<CalendarClock className="h-4 w-4" />}
          tone={toneFor(kpis.expiringSoonCount, "warning")}
          onClick={() => goTo({ expiryStatus: "warning" })}
        />
        <KpiCard
          label={t("dashboard.documentReadinessExpired")}
          value={kpis.expiredCount.toLocaleString()}
          icon={<CalendarX2 className="h-4 w-4" />}
          tone={toneFor(kpis.expiredCount, "serious")}
          onClick={() => goTo({ expiryStatus: "expired" })}
        />
        <KpiCard
          label={t("dashboard.documentReadinessPendingOcr")}
          value={kpis.pendingOcrReviewCount.toLocaleString()}
          icon={<ScanLine className="h-4 w-4" />}
          tone={toneFor(kpis.pendingOcrReviewCount, "neutral")}
          onClick={() => goTo({ pendingOcrReview: true })}
        />
        <KpiCard
          label={t("dashboard.documentReadinessUnsupported")}
          value={kpis.unsupportedDocumentCount.toLocaleString()}
          icon={<FileWarning className="h-4 w-4" />}
          tone={toneFor(kpis.unsupportedDocumentCount, "neutral")}
          onClick={() => goTo({ unsupportedDocument: true })}
        />
      </KpiGrid>
    </section>
  );
}
