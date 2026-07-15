"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderSortField } from "@/components/commander/query/types";
import { PriorityBadge, PromotionStatusBadge, RetirementStatusBadge } from "@/components/intelligence/intelligence_badge";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { UNKNOWN_POSITION_LEVEL } from "@/lib/commander_query/position_level";
import type { EligibilityStatus } from "@/lib/promotion/eligibility_policy";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import {
  formatAppointmentCycle,
  formatCompletedCyclesCount,
  formatEligibleOverdueYears,
  formatEligibleSinceCycle,
} from "@/lib/promotion_cycle/display";
import { cn } from "@/lib/ui/cn";

const ELIGIBILITY_META: Record<EligibilityStatus, { tone: NonNullable<BadgeProps["tone"]>; labelKey: TranslationKey }> = {
  eligible_now: { tone: "good", labelKey: "commander.eligibleNow" },
  overdue: { tone: "critical", labelKey: "commander.overdue" },
  eligible_soon: { tone: "warning", labelKey: "commander.eligibleSoon" },
  not_eligible: { tone: "neutral", labelKey: "commander.notEligible" },
};

const COLUMNS: Array<{ key: CommanderSortField; labelKey: TranslationKey; align?: "right" }> = [
  { key: "rank", labelKey: "commander.rank" },
  { key: "displayName", labelKey: "commander.name" },
  { key: "currentPosition", labelKey: "commander.currentPosition" },
  { key: "positionLevel", labelKey: "commander.positionLevel" },
  { key: "appointmentCycle", labelKey: "commander.appointmentCycle", align: "right" },
  { key: "completedPromotionCycles", labelKey: "commander.completedCycles", align: "right" },
  { key: "eligibleCycle", labelKey: "commander.eligibleSince", align: "right" },
  { key: "overdueCycles", labelKey: "commander.eligibleOverdue", align: "right" },
  { key: "ageYears", labelKey: "commander.age", align: "right" },
  { key: "promotionStatus", labelKey: "commander.promotion", align: undefined },
  { key: "retirementStatus", labelKey: "commander.retirement" },
  { key: "priority", labelKey: "commander.priority" },
];

function fmtAge(value: number | null): string {
  return value == null ? "—" : value.toFixed(1);
}

function fmtCell(value: string | null): string {
  return value ?? "—";
}

export function CommanderResultsTable({
  officers,
  sortBy,
  sortDirection,
  onSort,
}: {
  officers: CommanderQueryOfficer[];
  sortBy: CommanderSortField;
  sortDirection: "asc" | "desc";
  onSort: (field: CommanderSortField) => void;
}) {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("commander.resultsTable")}</CardTitle>
      </CardHeader>
      <CardBody>
        {officers.length === 0 ? (
          <p className="text-sm text-muted">{t("commander.noOfficersMatch")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-330 text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.portrait")}</th>
                  {COLUMNS.map((column) => {
                    const active = sortBy === column.key;
                    const columnLabel = t(column.labelKey);
                    return (
                      <th scope="col" key={column.key} className={cn("px-3 py-3 font-medium", column.align === "right" && "text-right")}>
                        <button
                          type="button"
                          className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground", column.align === "right" && "flex-row-reverse")}
                          onClick={() => onSort(column.key)}
                          aria-label={`${t("commander.sortBy")} ${columnLabel}`}
                        >
                          {columnLabel}
                          {active ? sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.targetLevel")}</th>
                </tr>
              </thead>
              <tbody>
                {officers.map((officer) => (
                  <tr key={officer.officerId} className="border-b border-border last:border-0 hover:bg-neutral-bg/60">
                    <td className="px-3 py-3">
                      <OfficerPhoto
                        name={officer.displayName}
                        thumbnailUrl={officer.thumbnailUrl}
                        driveFileId={officer.driveFileId}
                        webViewUrl={officer.webViewUrl}
                        size={32}
                      />
                    </td>
                    <td className="px-3 py-3 text-muted">{officer.rank || "—"}</td>
                    <td className="px-3 py-3 font-medium">
                      <Link href={`/officers/${encodeURIComponent(officer.officerId)}`} className="text-accent hover:underline">
                        {officer.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted">{officer.currentPosition || "—"}</td>
                    <td className="px-3 py-3 text-muted">{officer.positionLevel && officer.positionLevel !== UNKNOWN_POSITION_LEVEL ? officer.positionLevel : "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtCell(formatAppointmentCycle(officer.appointmentCycle))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtCell(formatCompletedCyclesCount(officer.completedPromotionCycles))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtCell(formatEligibleSinceCycle(officer.eligibleCycle))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtCell(formatEligibleOverdueYears(officer.overdueCycles))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtAge(officer.ageYears)}</td>
                    <td className="px-3 py-3"><PromotionStatusBadge status={officer.promotionStatus} /></td>
                    <td className="px-3 py-3"><RetirementStatusBadge status={officer.retirementStatus} /></td>
                    <td className="px-3 py-3"><PriorityBadge priority={officer.priority} /></td>
                    <td className="px-3 py-3">
                      {officer.nextLevelEligibility ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted">{officer.nextLevelEligibility.targetLevel}</span>
                          <Badge tone={ELIGIBILITY_META[officer.nextLevelEligibility.status].tone}>
                            {t(ELIGIBILITY_META[officer.nextLevelEligibility.status].labelKey)}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
