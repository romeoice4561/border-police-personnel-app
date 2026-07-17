/**
 * Officer Intelligence View Model composer (Phase 44 — Officer Intelligence
 * Workspace).
 *
 * Master Data -> Intelligence Engines -> THIS composer -> Officer Workspace
 * UI. Every calculated value here comes from an existing Intelligence
 * facade or the same per-officer Commander read-model composition
 * (`toQueryOfficer`, lib/server/commander_query_service.ts) Commander
 * Search already runs for the identical officer — nothing is recalculated
 * independently. `computeRetirementSummary` (lib/intelligence/retirement)
 * is called directly here since `toQueryOfficer` only exposes the raw
 * retirement year fields, not the full RetirementSummary this phase needs
 * (Task 6 — this is the ONE new facade wiring this phase adds; it is not a
 * second retirement calculation, it is the first call to the ALREADY-BUILT
 * facade for this data).
 *
 * Pure composition — no React, no direct Prisma calls (the caller passes
 * an already-loaded OfficerWithRelations + resolved portrait + org labels,
 * exactly like commander_query_service.ts's own callers do).
 *
 * Phase 44.1: `service.yearsInCurrentPositionLevel` and
 * `promotion.yearsInCurrentLevel` both read `queryOfficer.positionLevelYearCount`
 * — a commander-facing Buddhist-Era YEAR COUNT
 * (`currentYearBe - positionLevelStartYearBe`), NOT the deprecated
 * `queryOfficer.yearsInPositionLevel` (an exact elapsed decimal-years
 * duration that can silently truncate to one year less than the calendar
 * year-count implies). See lib/intelligence/shared/duration.ts's
 * `yearCountSince` doc comment for the full distinction.
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { toQueryOfficer } from "@/lib/commander_query/query_officer";
import { computeRetirementSummary } from "@/lib/intelligence/retirement";
import { computeAgeSummary } from "@/lib/intelligence/age";
import { computeProfileCompleteness } from "@/lib/ui/profile_completeness";
import { overdueOpportunities } from "@/lib/commander_query/promotion_display";
import { UNKNOWN_POSITION_LEVEL } from "@/lib/commander_query/position_level";
import { PROMOTION_STATUS_DISPLAY_TH } from "@/lib/intelligence/promotion";
import type { CommanderActionItem, OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";

function dateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Task 7: deterministic (non-AI) commander action items, derived from
 * already-computed fields — same officer, same flags a commander would see
 * on Commander Search/Dashboard, just reworded for a single-officer view.
 * Birthday proximity is intentionally NEVER included here (never presented
 * as a risk/action item per the task's explicit rule).
 */
function buildCommanderActions(
  promotionStatus: string,
  displayStatusTh: string | null,
  retirementRemainingDays: number | null,
  isRetired: boolean,
  hasOfficialPortrait: boolean,
  hasGp7: boolean,
  hasTraining: boolean,
  hasDocuments: boolean,
  timelineLength: number,
  ageAvailable: boolean,
  serviceAvailable: boolean
): CommanderActionItem[] {
  const items: CommanderActionItem[] = [];

  if (promotionStatus === "EligibleThisYear" || promotionStatus === "AlreadyEligible") {
    items.push({ textTh: "พิจารณาเสนอชื่อเลื่อนตำแหน่ง", severity: "recommended" });
  }
  if (promotionStatus === "MissingTraining") {
    items.push({ textTh: "ขาดหลักสูตรที่จำเป็นสำหรับการเลื่อนตำแหน่ง", severity: "recommended" });
  }
  if (promotionStatus === "MissingDocuments") {
    items.push({ textTh: "ขาดเอกสารที่จำเป็นสำหรับการเลื่อนตำแหน่ง", severity: "recommended" });
  }

  if (!isRetired && retirementRemainingDays != null && retirementRemainingDays <= 365) {
    items.push({ textTh: "ใกล้เกษียณภายใน 1 ปี", severity: "urgent" });
  } else if (!isRetired && retirementRemainingDays != null && retirementRemainingDays <= 365 * 3) {
    items.push({ textTh: "ใกล้เกษียณภายใน 3 ปี", severity: "informational" });
  }

  if (!hasOfficialPortrait) {
    items.push({ textTh: "เพิ่มรูป Official Portrait", severity: "recommended" });
  }
  if (!hasGp7) {
    items.push({ textTh: "เพิ่มเอกสาร GP.7", severity: "recommended" });
  }
  if (timelineLength === 0) {
    items.push({ textTh: "ตรวจสอบประวัติรับราชการ — ยังไม่มีข้อมูลประวัติการดำรงตำแหน่ง", severity: "recommended" });
  }
  if (!hasTraining) {
    items.push({ textTh: "ตรวจสอบข้อมูลการฝึกอบรม", severity: "informational" });
  }
  if (!hasDocuments) {
    items.push({ textTh: "ตรวจสอบข้อมูลเอกสารประกอบ", severity: "informational" });
  }
  if (!ageAvailable || !serviceAvailable) {
    items.push({ textTh: "ขาดข้อมูลที่จำเป็นต่อการวิเคราะห์ (วันเกิดหรือประวัติรับราชการ)", severity: "informational" });
  }
  if (promotionStatus === "Unknown") {
    items.push({ textTh: "ตรวจสอบข้อมูลตำแหน่ง — ไม่สามารถประเมินสถานะการเลื่อนตำแหน่งได้", severity: "recommended" });
  }

  return items;
}

/**
 * Composes the full Officer Intelligence View Model for one officer.
 * `asOf` defaults to now; pass an explicit value in tests for
 * deterministic `generatedAt`/`asOfDate` and Intelligence outputs.
 */
export function composeOfficerIntelligenceViewModel(
  officer: OfficerWithRelations,
  orgLabels: { company: string | null },
  officialPortraitUrl: string | null,
  asOf: Date = new Date()
): OfficerIntelligenceViewModel {
  const queryOfficer = toQueryOfficer(officer, asOf, orgLabels, officialPortraitUrl);
  const retirement = computeRetirementSummary(officer.dateOfBirth ?? null, asOf);
  const age = computeAgeSummary(officer.dateOfBirth ?? null, asOf);
  const completeness = computeProfileCompleteness(officer);
  const promotion = queryOfficer.promotionIntelligence;

  const missedOpportunities = overdueOpportunities(promotion.overdueYears);
  const hasGp7 = queryOfficer.hasGp7;
  const hasTraining = queryOfficer.hasTraining;
  const hasDocuments = queryOfficer.hasDocuments;
  const hasOfficialPortrait = officialPortraitUrl != null;

  const blockers: string[] = [];
  if (promotion.promotionStatus === "MissingTraining") blockers.push("ขาดหลักสูตรที่จำเป็น");
  if (promotion.promotionStatus === "MissingDocuments") blockers.push("ขาดเอกสารที่จำเป็น");
  if (promotion.promotionStatus === "RetirementRestricted") blockers.push("ติดเงื่อนไขระยะเวลาก่อนเกษียณอายุราชการ");

  return {
    generatedAt: asOf.toISOString(),
    asOfDate: dateOnlyIso(asOf),

    identity: {
      officerId: queryOfficer.officerId,
      displayName: queryOfficer.displayName,
      rank: queryOfficer.rank || null,
      position: queryOfficer.currentPosition,
      positionLevel: queryOfficer.positionLevel && queryOfficer.positionLevel !== UNKNOWN_POSITION_LEVEL ? queryOfficer.positionLevel : null,
      unit: queryOfficer.currentUnit,
      officialPortraitUrl,
    },

    age: {
      available: age.available,
      displayAgeTh: age.available ? age.displayAgeTh : null,
      ageYears: age.available ? age.exactAge?.years ?? null : null,
      nextBirthdayDate: age.available ? age.nextBirthdayDate : null,
      nextBirthdayAge: age.available ? age.nextBirthdayAge : null,
      daysUntilNextBirthday: age.available ? age.daysUntilNextBirthday : null,
      displayNextBirthdayTh: age.available ? age.displayNextBirthdayTh : null,
    },

    service: {
      available: queryOfficer.displayServiceDurationTh != null,
      serviceStartDate: null,
      displayServiceDurationTh: queryOfficer.displayServiceDurationTh,
      yearsInCurrentPositionLevel: queryOfficer.positionLevelYearCount,
      currentPositionLevelStartYearBe: queryOfficer.positionLevelStartYearBe,
    },

    promotion: {
      available: promotion.available,
      targetPositionTh: promotion.targetPosition,
      qualificationTextTh: promotion.targetPosition ? `ครบขึ้น ${promotion.targetPosition}` : null,
      status: promotion.promotionStatus,
      displayStatusTh: promotion.displayStatusTh ?? PROMOTION_STATUS_DISPLAY_TH[promotion.promotionStatus] ?? null,
      firstEligibleYearBe: promotion.eligibleFiscalYearBe,
      firstEligibleDate: promotion.eligibleDate,
      waitingYears: missedOpportunities,
      eligibilityYearNumber: promotion.overdueYears && promotion.overdueYears > 0 ? promotion.overdueYears : null,
      yearsInCurrentLevel: queryOfficer.positionLevelYearCount,
      promotionCyclesPassed: promotion.promotionCyclesPassed,
      blockers,
    },

    retirement: {
      available: retirement.available,
      retirementYearBe: retirement.available ? retirement.retirementFiscalYearBe : null,
      displayRetirementDateTh: retirement.available ? retirement.displayRetirementDateTh : null,
      displayRemainingTh: retirement.available ? retirement.displayRemainingTh : null,
      remainingDays: retirement.available ? retirement.remainingDays : null,
      isRetired: retirement.available ? retirement.isRetired : false,
    },

    commander: {
      priorityLevel: queryOfficer.priority,
      actionRequired:
        promotion.promotionStatus === "EligibleThisYear" ||
        promotion.promotionStatus === "AlreadyEligible" ||
        !hasOfficialPortrait ||
        !hasGp7 ||
        (retirement.available && !retirement.isRetired && retirement.remainingDays != null && retirement.remainingDays <= 365),
      recommendations: buildCommanderActions(
        promotion.promotionStatus,
        promotion.displayStatusTh,
        retirement.available ? retirement.remainingDays : null,
        retirement.available ? retirement.isRetired : false,
        hasOfficialPortrait,
        hasGp7,
        hasTraining,
        hasDocuments,
        officer.timeline.length,
        age.available,
        queryOfficer.displayServiceDurationTh != null
      ),
      flags: queryOfficer.flagCodes,
    },

    profileQuality: {
      available: true,
      completenessPercent: completeness.percent,
      missingItems: completeness.items.filter((item) => !item.complete).map((item) => item.label),
      hasOfficialPortrait,
      hasGp7,
    },
  };
}
