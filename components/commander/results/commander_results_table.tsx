/**
 * CommanderResultsTable (Commander Promotion UX refinement — presentation
 * and terminology only, no calculation changed).
 *
 * Rebuilt column set (task-specified order):
 *   รูป, ยศ ชื่อ-สกุล, ตำแหน่ง, หน่วย, ระดับตำแหน่ง, อายุ,
 *   ดำรงตำแหน่งนี้มาตั้งแต่ปี, จำนวนปีในระดับนี้, ระดับเป้าหมาย,
 *   ปีที่ครบครั้งแรก, เกินกำหนด, สถานะ, ปีนี้เป็นปีที่, ดูประวัติ.
 *
 * Every value renders directly from `officer.promotionIntelligence`
 * (PromotionSummary — Phase 41's single source of truth) or the existing,
 * unmodified Service/Timeline/Retirement fields already on
 * CommanderQueryOfficer:
 *   - อายุ:                       displayAgeYearsMonthsTh (Age Intelligence,
 *                                  years+months, never decimal).
 *   - ดำรงตำแหน่งนี้มาตั้งแต่ปี:      positionLevelStartYearBe (Timeline
 *                                  Intelligence — earliest timeline row at
 *                                  the current level — NOT appointment cycle).
 *   - จำนวนปีในระดับนี้:            yearsInPositionLevel (existing field,
 *                                  NOT a promotion-cycle count).
 *   - ระดับเป้าหมาย:               promotionIntelligence.targetPosition.
 *   - ปีที่ครบครั้งแรก:             promotionIntelligence.eligibleFiscalYearBe
 *                                  (Buddhist Era — never Gregorian).
 *   - เกินกำหนด:                  overdueYears - 1 (whole missed promotion
 *                                  opportunities: eligible since FY2568,
 *                                  current FY2569 -> overdueYears=2 ->
 *                                  1 missed opportunity), floored at 0,
 *                                  computed from the ALREADY-COMPUTED
 *                                  promotionIntelligence.overdueYears field
 *                                  — a presentation-only reinterpretation,
 *                                  not a new eligibility calculation.
 *   - สถานะ:                      promotionIntelligence.displayStatusTh
 *                                  (the existing PROMOTION_STATUS_DISPLAY_TH
 *                                  mapping), as a Badge.
 *   - ปีนี้เป็นปีที่:               promotionIntelligence.overdueYears,
 *                                  displayed as a bare number — never
 *                                  calculated from today's date.
 *
 * Horizontal scroll UX: DualScrollTable (top + bottom scrollbar, synced,
 * Shift+wheel, click-and-drag) wraps the table; รูป/ยศ ชื่อ-สกุล are sticky.
 */
"use client";

import Link from "next/link";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DualScrollTable } from "@/components/ui/dual_scroll_table";
import { UNKNOWN_POSITION_LEVEL } from "@/lib/commander_query/position_level";
import { overdueOpportunities } from "@/lib/commander_query/promotion_display";
import { useT } from "@/components/i18n/language_provider";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";

const STATUS_TONE: Record<PromotionEligibilityStatus, NonNullable<BadgeProps["tone"]>> = {
  EligibleThisYear: "good",
  AlreadyEligible: "warning",
  Waiting: "neutral",
  MissingTraining: "serious",
  MissingDocuments: "serious",
  RetirementRestricted: "critical",
  NotEligible: "neutral",
  Unknown: "neutral",
};

function cell(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export function CommanderResultsTable({ officers }: { officers: CommanderQueryOfficer[] }) {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("commander.resultsTable")}</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {officers.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">{t("commander.noOfficersMatch")}</p>
        ) : (
          <DualScrollTable>
            <table className="w-full min-w-330 text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-3 font-medium">{t("commander.portrait")}</th>
                  <th scope="col" className="sticky left-14 z-10 bg-surface px-3 py-3 font-medium">{t("commander.name")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.currentPosition")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.company")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.positionLevel")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.age")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.positionLevelStartYear")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.yearsInLevel")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.targetLevel")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.firstEligibleYear")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.overdueYears")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("commander.qualificationStatus")}</th>
                  <th scope="col" className="px-3 py-3 text-center font-medium">{t("commander.eligibilityYear")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("dashboard.priorityColumnAction")}</th>
                </tr>
              </thead>
              <tbody>
                {officers.map((officer) => {
                  const promotion = officer.promotionIntelligence;
                  const missedOpportunities = overdueOpportunities(promotion.overdueYears);
                  return (
                    <tr key={officer.officerId} className="border-b border-border align-middle last:border-0 hover:bg-neutral-bg/60">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-3">
                        <OfficerPhoto
                          name={officer.displayName}
                          thumbnailUrl={officer.thumbnailUrl}
                          driveFileId={officer.driveFileId}
                          webViewUrl={officer.webViewUrl}
                          size={32}
                        />
                      </td>
                      <td className="sticky left-14 z-10 bg-surface px-3 py-3 font-medium">
                        <Link href={`/officers/${encodeURIComponent(officer.officerId)}`} className="whitespace-normal wrap-break-word text-accent hover:underline">
                          {officer.rank ? `${officer.rank} ` : ""}
                          {officer.displayName}
                        </Link>
                      </td>
                      <td className="whitespace-normal wrap-break-word px-3 py-3 text-muted">{cell(officer.currentPosition)}</td>
                      <td className="whitespace-normal wrap-break-word px-3 py-3 text-muted">{cell(officer.currentUnit)}</td>
                      <td className="whitespace-normal wrap-break-word px-3 py-3 text-muted">
                        {officer.positionLevel && officer.positionLevel !== UNKNOWN_POSITION_LEVEL ? officer.positionLevel : "—"}
                      </td>
                      <td className="whitespace-normal px-3 py-3 text-muted">{cell(officer.displayAgeYearsMonthsTh)}</td>
                      <td className="px-3 py-3 tabular-nums text-muted">{cell(officer.positionLevelStartYearBe)}</td>
                      <td className="px-3 py-3 text-muted">{officer.yearsInPositionLevel != null ? `${Math.trunc(officer.yearsInPositionLevel)} ปี` : "—"}</td>
                      <td className="whitespace-normal wrap-break-word px-3 py-3 text-muted">{cell(promotion.targetPosition)}</td>
                      <td className="px-3 py-3 tabular-nums text-muted">{cell(promotion.eligibleFiscalYearBe)}</td>
                      <td className="px-3 py-3 text-muted">{missedOpportunities != null ? `${missedOpportunities} ปี` : "—"}</td>
                      <td className="px-3 py-3">
                        <Badge tone={STATUS_TONE[promotion.promotionStatus]}>{promotion.displayStatusTh}</Badge>
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-foreground">
                        {promotion.overdueYears && promotion.overdueYears > 0 ? promotion.overdueYears : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/officers/${encodeURIComponent(officer.officerId)}`}>{t("dashboard.priorityColumnAction")}</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DualScrollTable>
        )}
      </CardBody>
    </Card>
  );
}
