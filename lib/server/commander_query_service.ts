import "server-only";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { Timeline } from "@/lib/database/database_types";
import { calculateAge, calculateGovernmentServiceDuration, calculateRetirement, differenceYMD, type DurationYMD } from "@/lib/personnel_calendar";
import { officerFullName } from "@/lib/ui/officer_summary";
import { toEffectiveDate } from "@/lib/officer_profile/thai_date";
import { buildOfficerProfileIntelligence, loadCommanderOfficerProfiles } from "@/lib/server/commander_intelligence_service";
import { normalizePositionLevel, mapPositionTextToLevel, POSITION_LEVELS, UNKNOWN_POSITION_LEVEL } from "@/lib/commander_query/position_level";
import { evaluateNextLevelEligibility, type EligibilityOfficer } from "@/lib/promotion/eligibility_policy";
import type { PromotionCycleResult } from "@/lib/promotion_cycle";
import { countTwoStep, evaluateTwoStepEligibility, EligibilityStatus as SalaryEligibilityStatus } from "@/lib/officer_profile/career_salary_engine";
import type { CommanderEligibilitySummary, CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";

function yearsFromDuration(duration: DurationYMD | null): number | null {
  if (!duration) return null;
  return Number((duration.years + duration.months / 12 + duration.days / 365).toFixed(1));
}

function firstServiceLikeDate(officer: OfficerWithRelations): Date | null {
  const dates = officer.timeline
    .map((row) => toEffectiveDate(row))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}

function startedAtForMatchingTimeline(rows: Timeline[], predicate: (row: Timeline) => boolean): Date | null {
  const matches = rows
    .filter(predicate)
    .map((row) => toEffectiveDate(row))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return matches[0] ?? null;
}

function yearsSince(date: Date | null, asOf: Date): number | null {
  return yearsFromDuration(date ? differenceYMD(date, asOf) : null);
}

function hasActiveDocument(officer: OfficerWithRelations, typeCode: string): boolean {
  return officer.documents.some((doc) => doc.documentType === typeCode && doc.isActive !== false);
}

/**
 * Phase 41 Part 1: an officer's CURRENT position level is the structured
 * `positionLevel` on their most recent (present/newest) timeline row — the
 * authoritative, structured value, never re-derived from position text at
 * runtime. Falls back to mapping the current-position text ONLY when no
 * timeline row carries a known (non-Unknown) level yet, so an officer whose
 * timeline predates Phase 41 (and somehow escaped the backfill) still shows a
 * best-effort level rather than Unknown. Returns Unknown when nothing is known.
 */
function currentPositionLevel(officer: OfficerWithRelations): string {
  const newestFirst = [...officer.timeline]
    .map((row) => ({ row, date: toEffectiveDate(row) }))
    .sort((a, b) => {
      // Present rows first, then newest effective date first.
      if (a.row.isPresent !== b.row.isPresent) return a.row.isPresent ? -1 : 1;
      return (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity);
    });
  for (const { row } of newestFirst) {
    const level = normalizePositionLevel(row.positionLevel);
    if (level !== UNKNOWN_POSITION_LEVEL) return level;
  }
  // No structured level anywhere — best-effort from the current position text.
  return mapPositionTextToLevel(officer.currentPosition);
}

/** Phase 41 Part 3: earliest effective date among the timeline rows that share the officer's CURRENT position level — the point they first reached this level. */
function positionLevelStartedAt(officer: OfficerWithRelations, level: string): Date | null {
  if (level === UNKNOWN_POSITION_LEVEL) return null;
  return startedAtForMatchingTimeline(officer.timeline, (row) => normalizePositionLevel(row.positionLevel) === level);
}

function appointmentCycleForPositionLevel(officer: OfficerWithRelations, level: string): number | null {
  if (level === UNKNOWN_POSITION_LEVEL) return null;
  const matches = officer.timeline
    .filter((row) => normalizePositionLevel(row.positionLevel) === level)
    .map((row) => ({ row, date: toEffectiveDate(row) }))
    .sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
  const first = matches[0]?.row;
  return first?.appointmentCycle ?? first?.yearBE ?? null;
}

/**
 * Phase 41 Part 2–4: computes the officer's next-level promotion eligibility
 * once, here in the read model, via the shared configurable engine
 * (lib/promotion/eligibility_policy). Returns a compact summary the client can
 * filter/count on without re-running the engine. Null when not applicable.
 */
function computeNextLevelEligibility(
  officer: OfficerWithRelations,
  positionLevel: string,
  yearsInPositionLevel: number | null,
  yearsInRank: number | null,
  governmentServiceYears: number | null,
  retirementRemainingMonths: number | null,
  asOf: Date
): CommanderEligibilitySummary | null {
  const eligibilityInput: EligibilityOfficer = {
    currentRank: officer.rank,
    positionLevel,
    yearsInPositionLevel,
    yearsInRank,
    governmentServiceYears,
    retirementRemainingMonths,
    trainingCodes: officer.training.map((t) => t.course).filter((c): c is string => Boolean(c)),
    documentCodes: officer.documents.filter((d) => d.isActive !== false).map((d) => d.documentType),
    twoStepCount: countTwoStep(officer.salaryHistory),
    appointmentCycle: appointmentCycleForPositionLevel(officer, positionLevel),
  };
  const result = evaluateNextLevelEligibility(eligibilityInput, asOf);
  if (!result) return null;
  return {
    targetLevel: result.targetLevel,
    status: result.status,
    eligibleNow: result.eligibleNow,
    monthsUntilEligible: result.monthsUntilEligible,
    overdueYears: result.overdueYears,
    appointmentCycle: result.promotionCycle?.appointmentCycle ?? null,
    eligibleCycle: result.promotionCycle?.eligibleCycle ?? null,
    overdueCycles: result.promotionCycle?.overdueCycles ?? 0,
    promotionCycleBucket: promotionCycleBucket(result.promotionCycle),
  };
}

function promotionCycleBucket(cycle: PromotionCycleResult | null): CommanderEligibilitySummary["promotionCycleBucket"] {
  if (!cycle || cycle.overdueCycles <= 0) return "not_eligible";
  if (cycle.overdueCycles === 1) return "eligible_this_cycle";
  if (cycle.overdueCycles === 2) return "eligible_year_2";
  if (cycle.overdueCycles === 3) return "eligible_year_3";
  if (cycle.overdueCycles === 4) return "eligible_year_4";
  return "eligible_more_than_5";
}

function monthsFromDuration(duration: DurationYMD | null): number | null {
  if (!duration) return null;
  return duration.years * 12 + duration.months + (duration.days > 0 ? 1 : 0);
}

function toQueryOfficer(
  officer: OfficerWithRelations,
  asOf: Date,
  orgLabels: { company: string | null }
): CommanderQueryOfficer {
  const intelligence = buildOfficerProfileIntelligence(officer);
  const serviceStart = firstServiceLikeDate(officer);
  const rankStartedAt = startedAtForMatchingTimeline(officer.timeline, (row) => row.rank === officer.rank);
  const positionStartedAt = startedAtForMatchingTimeline(
    officer.timeline,
    (row) => row.position === officer.currentPosition || Boolean(officer.currentPosition && row.position.includes(officer.currentPosition))
  );
  const positionLevel = currentPositionLevel(officer);
  const positionLevelStart = positionLevelStartedAt(officer, positionLevel);
  const retirement = calculateRetirement(officer.dateOfBirth ?? null, asOf);
  const displayName = officerFullName(officer);

  const yearsInRank = yearsSince(rankStartedAt, asOf);
  const yearsInPositionLevel = yearsSince(positionLevelStart, asOf);
  const appointmentCycle = appointmentCycleForPositionLevel(officer, positionLevel);
  const governmentServiceYears = yearsFromDuration(calculateGovernmentServiceDuration(serviceStart, asOf));
  const retirementRemainingMonths = monthsFromDuration(retirement?.remaining ?? null);
  const twoStepEvaluation = evaluateTwoStepEligibility(officer.salaryHistory, asOf);
  const nextLevelEligibility = computeNextLevelEligibility(
    officer,
    positionLevel,
    yearsInPositionLevel,
    yearsInRank,
    governmentServiceYears,
    retirementRemainingMonths,
    asOf
  );

  return {
    officerId: officer.officerId,
    rank: officer.rank,
    firstName: officer.firstName,
    lastName: officer.lastName,
    displayName,
    currentPosition: officer.currentPosition,
    positionLevel,
    currentUnit: officer.currentUnit,
    regionId: officer.regionId,
    battalionId: officer.battalionId,
    companyId: officer.companyId,
    companyLabel: orgLabels.company || officer.currentUnit || "Unknown Company",
    yearsInRank,
    yearsInPosition: yearsSince(positionStartedAt, asOf),
    yearsInPositionLevel,
    appointmentCycle,
    governmentServiceYears,
    ageYears: yearsFromDuration(calculateAge(officer.dateOfBirth ?? null, asOf)),
    retirementYear: retirement?.retirementDate.getUTCFullYear() ?? null,
    promotionStatus: intelligence.promotionStatus,
    retirementStatus: intelligence.retirementStatus,
    priority: intelligence.priority,
    profileCompletenessPercent: intelligence.profileCompletenessPercent,
    flags: intelligence.flags,
    flagCodes: intelligence.flags.map((flag) => flag.code),
    hasGp7: hasActiveDocument(officer, "GP7"),
    hasOfficialPortrait: Boolean(officer.officialPortraitId || officer.thumbnailUrl || officer.driveFileId),
    hasTraining: officer.training.length > 0,
    hasDocuments: officer.documents.some((doc) => doc.isActive !== false),
    eligibleTwoStep: twoStepEvaluation.status === SalaryEligibilityStatus.Eligible,
    mustSkipStep: twoStepEvaluation.status === SalaryEligibilityStatus.NotEligible,
    nextLevelEligibility,
    eligibleCycle: nextLevelEligibility?.eligibleCycle ?? null,
    overdueCycles: nextLevelEligibility?.overdueCycles ?? 0,
    promotionCycleBucket: nextLevelEligibility?.promotionCycleBucket ?? "not_eligible",
    thumbnailUrl: officer.thumbnailUrl,
    driveFileId: officer.driveFileId,
    webViewUrl: officer.webViewUrl,
  };
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b, "th"));
}

export async function getCommanderQueryDataset(): Promise<CommanderQueryDataset> {
  const asOf = new Date();
  const [officers, organizationEngine] = await Promise.all([
    loadCommanderOfficerProfiles(),
    loadOrganizationEngine(),
  ]);
  const rows = officers.map((officer) => {
    const labels = organizationEngine.resolveLabels({
      headquartersId: officer.headquartersId,
      regionId: officer.regionId,
      battalionId: officer.battalionId,
      companyId: officer.companyId,
    });
    return toQueryOfficer(officer, asOf, labels);
  });

  return {
    officers: rows,
    options: {
      ranks: uniqueSorted(rows.map((row) => row.rank)),
      positionLevels: [...POSITION_LEVELS],
      regions: organizationEngine.getRegions().map((region) => ({
        id: region.id,
        label: organizationEngine.resolveLabels({ headquartersId: region.headquartersId, regionId: region.id, battalionId: null, companyId: null }).borderPatrolDivision ?? region.nameTh,
      })),
      battalions: organizationEngine.getBattalions().map((battalion) => ({
        id: battalion.id,
        regionId: battalion.regionId,
        label: battalion.nameTh,
      })),
      companies: organizationEngine.getCompanies().map((company) => ({
        id: company.id,
        battalionId: company.battalionId,
        label: company.nameTh,
      })),
      priorities: ["low", "medium", "high", "critical"],
    },
  };
}
