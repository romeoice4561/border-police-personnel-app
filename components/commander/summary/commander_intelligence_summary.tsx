/**
 * CommanderIntelligenceSummary (Phase 43 Workstream A, Task A2).
 *
 * A row of Thai commander-readable summary cards sitting above the results
 * table, reflecting the CURRENTLY-FILTERED result set (the same `officers`
 * array the table/charts receive — never a separate query). Every count is
 * a plain `.length`/`.filter().length` over `promotionIntelligence`
 * (PromotionSummary — Phase 41's single source of truth) or existing
 * retirement fields; no eligibility/status is recalculated here.
 *
 * Cards (per spec): ผลลัพธ์ทั้งหมด, ครบคุณสมบัติปีนี้, มีคุณสมบัติครบแล้ว,
 * รอการแต่งตั้ง (= Waiting), ขาดหลักสูตร, ขาดเอกสาร, ใกล้เกษียณ,
 * ไม่สามารถวิเคราะห์ได้. Each (except the total) is clickable and applies
 * the matching `promotionEligibilityStatus` filter — the SAME filter field
 * Commander Dashboard drill-down links already use — so clicking a card is
 * just a filter change, not a separate code path.
 */
"use client";

import { AlertTriangle, CheckCircle2, Clock, FileWarning, GraduationCap, HelpCircle, Search, Timer } from "lucide-react";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderQueryFilters } from "@/components/commander/query/types";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { Card, CardBody } from "@/components/ui/card";

interface StatusCardSpec {
  labelKey: TranslationKey;
  status: PromotionEligibilityStatus | null;
  icon: React.ReactNode;
}

const STATUS_CARDS: StatusCardSpec[] = [
  { labelKey: "commander.summaryTotal", status: null, icon: <Search className="h-4 w-4" /> },
  { labelKey: "commander.summaryEligibleThisYear", status: "EligibleThisYear", icon: <CheckCircle2 className="h-4 w-4" /> },
  { labelKey: "commander.summaryAlreadyEligible", status: "AlreadyEligible", icon: <Clock className="h-4 w-4" /> },
  { labelKey: "commander.summaryWaiting", status: "Waiting", icon: <Timer className="h-4 w-4" /> },
  { labelKey: "commander.summaryMissingTraining", status: "MissingTraining", icon: <GraduationCap className="h-4 w-4" /> },
  { labelKey: "commander.summaryMissingDocuments", status: "MissingDocuments", icon: <FileWarning className="h-4 w-4" /> },
  { labelKey: "commander.summaryRetirementRestricted", status: "RetirementRestricted", icon: <AlertTriangle className="h-4 w-4" /> },
  { labelKey: "commander.summaryUnknown", status: "Unknown", icon: <HelpCircle className="h-4 w-4" /> },
];

function countForStatus(officers: readonly CommanderQueryOfficer[], status: PromotionEligibilityStatus | null): number {
  if (status === null) return officers.length;
  return officers.filter((officer) => officer.promotionIntelligence.promotionStatus === status).length;
}

export function CommanderIntelligenceSummary({
  officers,
  activeStatus,
  onSelectStatus,
}: {
  officers: CommanderQueryOfficer[];
  activeStatus?: PromotionEligibilityStatus;
  onSelectStatus: (filters: CommanderQueryFilters) => void;
}) {
  const { t } = useT();
  return (
    <section aria-label={t("commander.intelligenceSummary")}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("commander.intelligenceSummary")}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {STATUS_CARDS.map(({ labelKey, status, icon }) => {
          const count = countForStatus(officers, status);
          const isActive = status !== null && activeStatus === status;
          const clickable = status !== null;
          const content = (
            <CardBody className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted">{t(labelKey)}</p>
                <span className="text-muted" aria-hidden="true">{icon}</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{count.toLocaleString()}</p>
            </CardBody>
          );
          return clickable ? (
            <button
              key={labelKey}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelectStatus({ promotionEligibilityStatus: status })}
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
            >
              <Card className={`h-full transition-colors ${isActive ? "border-accent bg-accent/5" : "hover:border-accent"}`}>{content}</Card>
            </button>
          ) : (
            <Card key={labelKey} className="h-full">{content}</Card>
          );
        })}
      </div>
    </section>
  );
}
