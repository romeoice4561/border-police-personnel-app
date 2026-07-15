import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { Timeline } from "@/lib/database/database_types";
import { normalizePositionLevel, nextPositionLevel, UNKNOWN_POSITION_LEVEL, mapPositionTextToLevel, type PositionLevel } from "@/lib/commander_query/position_level";
import { toEffectiveDate } from "@/lib/officer_profile/thai_date";
import { evaluateNextLevelEligibility, type EligibilityOfficer, type LevelEligibilityResult } from "@/lib/promotion/eligibility_policy";
import { formatPromotionCycleSummary } from "@/lib/promotion_cycle/display";
import type { PromotionCycleResult } from "@/lib/promotion_cycle/types";

/** Read-only promotion cycle summary for Officer Profile and shared consumers. */
export interface OfficerPromotionCycleDisplay {
  currentPosition: string | null;
  positionLevel: string;
  appointmentCycle: number | null;
  completedCycles: number | null;
  targetLevel: string | null;
  eligibleCycle: number | null;
  eligibleNow: boolean;
  overdueCycles: number;
  readyLabel: string | null;
  eligibleSinceLabel: string | null;
  statusLabel: string | null;
  completedLabel: string | null;
}

export function currentPositionLevelFromTimeline(officer: OfficerWithRelations): string {
  const newestFirst = [...officer.timeline]
    .map((row) => ({ row, date: toEffectiveDate(row) }))
    .sort((a, b) => {
      if (a.row.isPresent !== b.row.isPresent) return a.row.isPresent ? -1 : 1;
      return (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? Infinity);
    });
  for (const { row } of newestFirst) {
    const level = normalizePositionLevel(row.positionLevel);
    if (level !== UNKNOWN_POSITION_LEVEL) return level;
  }
  return mapPositionTextToLevel(officer.currentPosition);
}

export function appointmentCycleForPositionLevel(officer: OfficerWithRelations, level: string): number | null {
  if (level === UNKNOWN_POSITION_LEVEL) return null;
  const matches = officer.timeline
    .filter((row) => normalizePositionLevel(row.positionLevel) === level)
    .map((row) => ({ row, date: toEffectiveDate(row) }))
    .sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
  const first = matches[0]?.row;
  return first?.appointmentCycle ?? first?.yearBE ?? null;
}

export function buildEligibilityOfficerFromProfile(
  officer: OfficerWithRelations,
  asOf: Date = new Date()
): { input: EligibilityOfficer; positionLevel: string; appointmentCycle: number | null } {
  const positionLevel = currentPositionLevelFromTimeline(officer);
  const appointmentCycle = appointmentCycleForPositionLevel(officer, positionLevel);
  return {
    positionLevel,
    appointmentCycle,
    input: {
      currentRank: officer.rank,
      positionLevel,
      yearsInPositionLevel: null,
      yearsInRank: null,
      governmentServiceYears: null,
      retirementRemainingMonths: null,
      trainingCodes: officer.training.map((t) => t.course).filter((c): c is string => Boolean(c)),
      documentCodes: officer.documents.filter((d) => d.isActive !== false).map((d) => d.documentType),
      twoStepCount: 0,
      appointmentCycle,
    },
  };
}

export function buildOfficerPromotionCycleDisplay(
  officer: OfficerWithRelations,
  asOf: Date = new Date()
): OfficerPromotionCycleDisplay | null {
  const { input, positionLevel, appointmentCycle } = buildEligibilityOfficerFromProfile(officer, asOf);
  const result = evaluateNextLevelEligibility(input, asOf);
  if (!result) return null;

  const cycle = result.promotionCycle;
  const labels = formatPromotionCycleSummary(cycle, result.targetLevel);

  return {
    currentPosition: officer.currentPosition,
    positionLevel,
    appointmentCycle,
    completedCycles: cycle?.completedPromotionCycles ?? null,
    targetLevel: result.targetLevel,
    eligibleCycle: cycle?.eligibleCycle ?? null,
    eligibleNow: cycle?.eligibleNow ?? false,
    overdueCycles: cycle?.overdueCycles ?? 0,
    ...labels,
  };
}

export function isReadyForTargetLevel(result: LevelEligibilityResult | null, targetLevel: string): boolean {
  if (!result || result.targetLevel !== targetLevel) return false;
  return result.promotionCycle?.eligibleNow === true;
}

export function promotionCycleFromTimelineRow(row: Timeline): number | null {
  return row.appointmentCycle ?? row.yearBE ?? null;
}

export function nextTargetLevelForOfficer(officer: OfficerWithRelations): string | null {
  const level = currentPositionLevelFromTimeline(officer);
  if (level === UNKNOWN_POSITION_LEVEL) return null;
  return nextPositionLevel(level as PositionLevel);
}
