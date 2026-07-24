/**
 * CommanderResultsTable (Phase 43 — Commander Search Intelligence, Table
 * UX, and Official Portrait Consistency — Task A4/B/C).
 *
 * Rebuilt to the Phase 43 16-column order:
 *   รูป, ยศ ชื่อ–สกุล, ตำแหน่ง, หน่วย, ระดับตำแหน่ง, อายุ,
 *   ดำรงตำแหน่งนี้มาตั้งแต่ปี, จำนวนปีในระดับนี้, ระดับเป้าหมาย,
 *   ปีที่ครบครั้งแรก, รอการแต่งตั้งมาแล้ว, สถานะ, ปีนี้เป็นปีที่,
 *   ปีเกษียณอายุราชการ, อายุราชการ, ดูประวัติ.
 *
 * Every value renders directly from `officer.promotionIntelligence`
 * (PromotionSummary — Phase 41's single source of truth) or the existing,
 * unmodified Service/Timeline/Retirement/Portrait fields already on
 * CommanderQueryOfficer — no calculation happens in this component:
 *   - รูป:                        officialPortraitUrl (Phase 43 Workstream
 *                                  C — the ONE canonical portrait resolver,
 *                                  batch-resolved once in
 *                                  getCommanderQueryDataset(); never the
 *                                  raw/unreliable thumbnailUrl field).
 *   - อายุ:                       displayAgeYearsMonthsTh (Age Intelligence,
 *                                  years+months, never decimal).
 *   - ดำรงตำแหน่งนี้มาตั้งแต่ปี:      positionLevelStartYearBe (Timeline
 *                                  Intelligence — earliest timeline row at
 *                                  the current level — NOT appointment cycle).
 *   - จำนวนปีในระดับนี้:            positionLevelYearCount (Phase 44.1 —
 *                                  currentYearBe - positionLevelStartYearBe,
 *                                  a Buddhist-Era calendar-year count, NOT
 *                                  the deprecated yearsInPositionLevel exact
 *                                  duration and NOT a promotion-cycle count).
 *   - ระดับเป้าหมาย:               promotionIntelligence.targetPosition.
 *   - ปีที่ครบครั้งแรก:             promotionIntelligence.firstEligibleFiscalYearBe
 *                                  (Buddhist Era — never Gregorian). Phase
 *                                  49.7 fix: was eligibleFiscalYearBe, which
 *                                  stays null until the officer is ALREADY
 *                                  eligible — this column showed "—" for
 *                                  every not-yet-eligible officer even
 *                                  though the engine could project their
 *                                  first eligible year. firstEligibleFiscalYearBe
 *                                  is the SAME projection regardless of
 *                                  eligibleNow, computed by the same engine
 *                                  (no new calculation here).
 *   - รอการแต่งตั้งมาแล้ว:          PromotionSummary.overdueYears when > 0
 *                                  (completed waiting years; first eligible
 *                                  cycle = 0 → display "—"). Via
 *                                  overdueOpportunities() — identity since
 *                                  Phase 49.9 (no local −1). Label renamed
 *                                  from legacy "เกินกำหนด" per Phase 43.
 *   - สถานะ:                      promotionIntelligence.displayStatusTh
 *                                  (the existing PROMOTION_STATUS_DISPLAY_TH
 *                                  mapping), as a Badge.
 *   - ปีนี้เป็นปีที่:               promotionIntelligence.eligibleYearOrdinal,
 *                                  displayed as a bare number — never
 *                                  calculated from today's date.
 *   - ปีเกษียณอายุราชการ:          retirementYearBe (Buddhist Era only).
 *   - อายุราชการ:                 displayServiceDurationTh (Service
 *                                  Intelligence, exact/compact, never
 *                                  decimal).
 *
 * Horizontal scroll UX: DualScrollTable (top + bottom scrollbar, synced,
 * Shift+wheel, click-and-drag) wraps the table; รูป/ยศ ชื่อ-สกุล are sticky,
 * with min-widths matching the Phase 43 recommendation so text never
 * compresses into unreadable stacks.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DualScrollTable } from "@/components/ui/dual_scroll_table";
import { UNKNOWN_POSITION_LEVEL } from "@/lib/commander_query/position_level";
import { overdueOpportunities } from "@/lib/commander_query/promotion_display";
import { useT } from "@/components/i18n/language_provider";
import { PROMOTION_STATUS_TONE } from "@/lib/intelligence/promotion/status_tone";
import { TRAINING_STATUS_TONE } from "@/lib/intelligence/training/status_tone";
import { READINESS_LEVEL_TONE, COMPLETENESS_LEVEL_TONE } from "@/lib/integration/documents/readiness_tone";
import { localizedReadinessLabel } from "@/lib/integration/documents/localize_document_intelligence";

/** Phase 49.8: PromotionSummary.confidence -> Badge tone. "confirmed" intentionally has no badge shown in the table (see the confidence column's cell) — only non-confirmed states need a visual flag. */
const CONFIDENCE_TONE: Record<"confirmed" | "derived" | "incomplete" | "unknown", "good" | "warning" | "serious" | "neutral"> = {
  confirmed: "good",
  derived: "warning",
  incomplete: "warning",
  unknown: "neutral",
};

/** Phase 43 B5: photo column is 72px wide (matching the Dashboard table); the sticky name column starts right after it. */
const PHOTO_COL_PX = 72;

function cell(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export function CommanderResultsTable({
  officers,
  /** Phase 49A: when the caller's active filters already include a document-intelligence field, the document columns default to visible — per spec §6 ("when document-intelligence filters are active, expose appropriate columns") — the user can still toggle them off/on manually afterward. */
  documentFiltersActive = false,
}: {
  officers: CommanderQueryOfficer[];
  documentFiltersActive?: boolean;
}) {
  const { t, language } = useT();
  // Phase 45 Task 11: the training status column defaults to HIDDEN — the
  // table is already 16 columns wide (Phase 43); a 17th column is opt-in
  // rather than always rendered, per the task's explicit "column visibility
  // may default to hidden if the table is already wide" rule.
  const [showTrainingColumn, setShowTrainingColumn] = useState(false);
  // Phase 49A: mirrors the training-column toggle exactly, but defaults ON
  // when document filters are already active (the user just asked to see
  // this data by filtering on it).
  const [showDocumentColumns, setShowDocumentColumns] = useState(documentFiltersActive);
  // Phase 49.8: rank tenure + data confidence — opt-in, mirroring the
  // training/document toggles exactly (the table is already wide).
  const [showRankConfidenceColumns, setShowRankConfidenceColumns] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>{t("commander.resultsTable")}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowTrainingColumn((prev) => !prev)}>
            {showTrainingColumn ? t("commander.hideTrainingColumn") : t("commander.showTrainingColumn")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowDocumentColumns((prev) => !prev)}>
            {showDocumentColumns ? t("commander.hideDocumentColumns") : t("commander.showDocumentColumns")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowRankConfidenceColumns((prev) => !prev)}>
            {showRankConfidenceColumns ? t("commander.hideRankConfidenceColumns") : t("commander.showRankConfidenceColumns")}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {officers.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">{t("commander.noOfficersMatch")}</p>
        ) : (
          <DualScrollTable>
            <table className="w-full min-w-330 text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-3 font-medium" style={{ minWidth: PHOTO_COL_PX, width: PHOTO_COL_PX }}>{t("commander.portrait")}</th>
                  <th scope="col" className="sticky z-10 bg-surface px-3 py-3 font-medium" style={{ left: PHOTO_COL_PX, minWidth: 220 }}>{t("commander.name")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 200 }}>{t("commander.currentPosition")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 150 }}>{t("commander.company")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 140 }}>{t("commander.positionLevel")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 140 }}>{t("commander.age")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 160 }}>{t("commander.positionLevelStartYear")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 150 }}>{t("commander.yearsInLevel")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 180 }}>{t("commander.targetLevel")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 140 }}>{t("commander.firstEligibleYear")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 160 }}>{t("commander.overdueYears")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 180 }}>{t("commander.qualificationStatus")}</th>
                  <th scope="col" className="px-3 py-3 text-center font-medium" style={{ minWidth: 110 }}>{t("commander.eligibilityYear")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 140 }}>{t("commander.retirementYear")}</th>
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 150 }}>{t("commander.governmentServiceYears")}</th>
                  {showTrainingColumn ? (
                    <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 180 }}>{t("commander.trainingStatus")}</th>
                  ) : null}
                  {showRankConfidenceColumns ? (
                    <>
                      <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 160 }}>{t("commander.rankStartYear")}</th>
                      <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 130 }}>{t("commander.yearsInRank")}</th>
                      <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 160 }}>{t("commander.dataConfidence")}</th>
                    </>
                  ) : null}
                  {showDocumentColumns ? (
                    <>
                      <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 160 }}>{t("commander.documentReadiness")}</th>
                      <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 140 }}>{t("commander.documentCompleteness")}</th>
                      <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 180 }}>{t("commander.documentMissing")}</th>
                      <th scope="col" className="px-3 py-3 text-center font-medium" style={{ minWidth: 100 }}>{t("commander.documentPendingReview")}</th>
                      <th scope="col" className="px-3 py-3 text-center font-medium" style={{ minWidth: 100 }}>{t("commander.documentExpiringSoon")}</th>
                      <th scope="col" className="px-3 py-3 text-center font-medium" style={{ minWidth: 100 }}>{t("commander.documentExpired")}</th>
                      <th scope="col" className="px-3 py-3 text-center font-medium" style={{ minWidth: 100 }}>{t("commander.documentQualityWarning")}</th>
                      <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 200 }}>{t("commander.documentNextAction")}</th>
                    </>
                  ) : null}
                  <th scope="col" className="px-3 py-3 font-medium" style={{ minWidth: 110 }}>{t("dashboard.priorityColumnAction")}</th>
                </tr>
              </thead>
              <tbody>
                {officers.map((officer) => {
                  const promotion = officer.promotionIntelligence;
                  const missedOpportunities = overdueOpportunities(promotion.overdueYears);
                  return (
                    <tr key={officer.officerId} className="border-b border-border align-middle last:border-0 hover:bg-neutral-bg/60">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-3" style={{ minWidth: PHOTO_COL_PX, width: PHOTO_COL_PX }}>
                        <OfficerPhoto
                          name={officer.displayName}
                          thumbnailUrl={officer.officialPortraitUrl}
                          size={48}
                        />
                      </td>
                      <td className="sticky z-10 bg-surface px-3 py-3 font-medium" style={{ left: PHOTO_COL_PX, minWidth: 220 }}>
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
                      <td className="px-3 py-3 text-muted">{officer.positionLevelYearCount != null ? `${officer.positionLevelYearCount} ปี` : "—"}</td>
                      <td className="whitespace-normal wrap-break-word px-3 py-3 text-muted">{cell(promotion.targetPosition)}</td>
                      <td className="px-3 py-3 tabular-nums text-muted">{cell(promotion.eligibleFiscalYearBe)}</td>
                      <td className="px-3 py-3 text-muted">{missedOpportunities != null ? `${missedOpportunities} ปี` : "—"}</td>
                      <td className="px-3 py-3">
                        <Badge tone={PROMOTION_STATUS_TONE[promotion.promotionStatus]}>{promotion.displayStatusTh}</Badge>
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-foreground">
                        {promotion.eligibleYearOrdinal != null && promotion.eligibleYearOrdinal > 0 ? (
                          promotion.eligibleYearOrdinal
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-muted">{officer.retirementYearBe != null ? `พ.ศ. ${officer.retirementYearBe}` : "—"}</td>
                      <td className="whitespace-normal wrap-break-word px-3 py-3 text-muted">{cell(officer.displayServiceDurationTh)}</td>
                      {showTrainingColumn ? (
                        <td className="px-3 py-3">
                          <Badge tone={TRAINING_STATUS_TONE[officer.trainingIntelligence.trainingStatus]}>{officer.trainingIntelligence.displayStatusTh}</Badge>
                        </td>
                      ) : null}
                      {showRankConfidenceColumns ? (
                        <>
                          <td className="px-3 py-3 tabular-nums text-muted">{officer.rankStartedAtYearBe != null ? `พ.ศ. ${officer.rankStartedAtYearBe}` : "—"}</td>
                          <td className="px-3 py-3 text-muted">{officer.yearsInRankCount != null ? `${officer.yearsInRankCount} ปี` : "—"}</td>
                          <td className="px-3 py-3">
                            <Badge tone={CONFIDENCE_TONE[promotion.confidence]}>
                              {promotion.confidence === "confirmed" ? t("commander.confidenceConfirmed") : promotion.confidenceReasonTh ?? t("commander.confidenceIncomplete")}
                            </Badge>
                          </td>
                        </>
                      ) : null}
                      {showDocumentColumns ? (
                        <>
                          <td className="px-3 py-3">
                            <Badge tone={READINESS_LEVEL_TONE[officer.documentIntelligence.readinessLevel]}>
                              {localizedReadinessLabel(officer.documentIntelligence.readinessLevel, language)}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={COMPLETENESS_LEVEL_TONE[officer.documentIntelligence.completenessLevel]}>
                              {officer.documentIntelligence.completenessScore}%
                            </Badge>
                          </td>
                          <td className="whitespace-normal wrap-break-word px-3 py-3 text-muted">
                            {officer.documentIntelligence.missingRequiredCount > 0
                              ? officer.documentIntelligence.missingRequiredDocuments.join(", ")
                              : t("commander.documentNoneMissing")}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums text-muted">{officer.documentIntelligence.pendingReviewCount}</td>
                          <td className="px-3 py-3 text-center tabular-nums text-muted">{officer.documentIntelligence.expiringSoonCount}</td>
                          <td className="px-3 py-3 text-center tabular-nums text-muted">{officer.documentIntelligence.expiredCount}</td>
                          <td className="px-3 py-3 text-center tabular-nums text-muted">{officer.documentIntelligence.qualityWarningCount}</td>
                          <td className="whitespace-normal wrap-break-word px-3 py-3 text-muted">{officer.documentIntelligence.primaryActionLabelTh}</td>
                        </>
                      ) : null}
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
