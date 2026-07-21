/**
 * Per-officer Commander read-model composition (extracted from
 * lib/server/commander_query_service.ts, Phase 44).
 *
 * Pure — no `server-only`, no Prisma, no I/O — so it can be unit-tested
 * directly and reused by any single-officer consumer (Commander Search's
 * batch dataset builder, and Phase 44's Officer Intelligence View Model)
 * without either one recalculating age/service/promotion/retirement/
 * timeline values independently. `getCommanderQueryDataset()` (the
 * server-only entry point) and `composeOfficerIntelligenceViewModel` both
 * call `toQueryOfficer` — it IS the one calculation, not duplicated by
 * being called from two places.
 */
import type { OfficerWithRelations, Timeline } from "@/lib/database/query_types";
import { calculateAge, calculateGovernmentServiceDuration, calculateRetirement } from "@/lib/personnel_calendar";
import { officerFullName } from "@/lib/ui/officer_summary";
import { toEffectiveDate } from "@/lib/officer_profile/thai_date";
import { buildOfficerProfileIntelligence } from "@/lib/intelligence/officer_intelligence_input";
import { normalizePositionLevel, mapPositionTextToLevel, UNKNOWN_POSITION_LEVEL } from "@/lib/commander_query/position_level";
import { evaluateNextLevelEligibility, type EligibilityOfficer } from "@/lib/promotion/eligibility_policy";
import { promotionCycleBucket } from "@/lib/promotion_cycle/intelligence";
import { countTwoStep, evaluateTwoStepEligibility, EligibilityStatus as SalaryEligibilityStatus } from "@/lib/officer_profile/career_salary_engine";
import { toSkillSignals } from "@/lib/capability/skill_filter";
import type { CommanderEligibilitySummary, CommanderQueryOfficer } from "@/lib/commander_query/types";
import { firstServiceLikeDate, startedAtForMatchingTimeline } from "@/lib/intelligence/shared/timeline_dates";
import { yearsFromDuration, yearsSince, yearCountSince, monthsFromDuration } from "@/lib/intelligence/shared/duration";
import { toBuddhistEraYear } from "@/lib/intelligence/shared/thai_date";
import { computePromotionSummary } from "@/lib/intelligence/promotion";
import { computeServiceSummary } from "@/lib/intelligence/service";
import { computeAgeSummary } from "@/lib/intelligence/age";
import { computeTrainingSummary } from "@/lib/intelligence/training";
import { normalizeCourseName } from "@/lib/intelligence/training/course_normalization";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { computeExpiryInfo } from "@/lib/document/document_expiry";

function hasActiveDocument(officer: OfficerWithRelations, typeCode: string): boolean {
  return officer.documents.some((doc) => doc.documentType === typeCode && doc.isActive !== false);
}

/**
 * Commander Promotion UX refinement: "40 ปี, 11 เดือน" — years + months
 * only (no days), matching the requested display precision for the
 * Commander Search "อายุ" column. Pure text formatting of an ALREADY-
 * COMPUTED AgeSummary.exactAge (lib/intelligence/age) — not a new age
 * calculation. Never decimal, never a raw day count.
 */
function formatAgeYearsMonthsTh(exactAge: { years: number; months: number } | null): string | null {
  if (!exactAge) return null;
  return `${exactAge.years} ปี, ${exactAge.months} เดือน`;
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

/**
 * The row's EFFECTIVE position level for tenure-start selection: the
 * stored, structured `positionLevel` whenever it is present and valid
 * (authoritative, unchanged — see position_level.ts's own doc comment).
 * Only when the stored value is missing/Unknown does this fall back to
 * classifying the row's free-text `position` via the existing canonical
 * classifier (`mapPositionTextToLevel`) — recovering legacy/un-backfilled
 * rows (e.g. "รอง ผกก.2 ส.3" stored with no positionLevel) that are still
 * reliably classifiable, rather than silently skipping them and anchoring
 * tenure at a LATER row. Does not modify the stored row or affect any
 * other consumer of Timeline.positionLevel — used only here.
 */
function effectivePositionLevel(row: Timeline): string {
  const stored = normalizePositionLevel(row.positionLevel);
  if (stored !== UNKNOWN_POSITION_LEVEL) return stored;
  return mapPositionTextToLevel(row.position);
}

/** Phase 41 Part 3 (Phase 44.1 fix): earliest effective date among the timeline rows that share the officer's CURRENT position level — the point they first reached this level. Uses effectivePositionLevel so a legacy row missing its stored positionLevel, but still classifiable from its free-text position, is not skipped in favor of a later row. */
function positionLevelStartedAt(officer: OfficerWithRelations, level: string): Date | null {
  if (level === UNKNOWN_POSITION_LEVEL) return null;
  return startedAtForMatchingTimeline(officer.timeline, (row) => effectivePositionLevel(row) === level);
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
 * Phase 41: assembles the compact `EligibilityOfficer` shape the eligibility
 * engine (lib/promotion/eligibility_policy) and the Promotion Intelligence
 * facade (lib/intelligence/promotion) both consume — extracted so both
 * `computeNextLevelEligibility` and the new `promotionIntelligence` field
 * build it identically, once, rather than duplicating the same assembly.
 *
 * Phase 45: `trainingCodes` is now sourced from Training Intelligence's
 * normalized course keys (lib/intelligence/training/course_normalization.ts)
 * instead of raw free-text `Training.course` strings — the evidence
 * PROVIDER changed, but since `PROMOTION_POLICIES.requiredTrainingCodes` is
 * empty for every level today (see docs/TRAINING_INTELLIGENCE.md), no
 * eligibility outcome changes: `createRequiredTrainingRule` never runs
 * without a configured code list to check against. If a future policy adds
 * `requiredTrainingCodes`, matching becomes correct-by-construction (exact
 * normalized key, never a raw-string coincidence) rather than an
 * accidental substring/exact-string match on unnormalized free text.
 */
function buildEligibilityOfficer(
  officer: OfficerWithRelations,
  positionLevel: string,
  yearsInPositionLevel: number | null,
  yearsInRank: number | null,
  governmentServiceYears: number | null,
  retirementRemainingMonths: number | null
): EligibilityOfficer {
  return {
    currentRank: officer.rank,
    positionLevel,
    yearsInPositionLevel,
    yearsInRank,
    governmentServiceYears,
    retirementRemainingMonths,
    trainingCodes: officer.training
      .map((t) => normalizeCourseName(t.course).normalizedCourseKey)
      .filter((key): key is string => Boolean(key)),
    documentCodes: officer.documents.filter((d) => d.isActive !== false).map((d) => d.documentType),
    twoStepCount: countTwoStep(officer.salaryHistory),
    appointmentCycle: appointmentCycleForPositionLevel(officer, positionLevel),
  };
}

/**
 * Phase 41 Part 2–4: computes the officer's next-level promotion eligibility
 * once, here in the read model, via the shared configurable engine
 * (lib/promotion/eligibility_policy). Returns a compact summary the client can
 * filter/count on without re-running the engine. Null when not applicable.
 */
function computeNextLevelEligibility(eligibilityInput: EligibilityOfficer, asOf: Date): CommanderEligibilitySummary | null {
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
    completedPromotionCycles: result.promotionCycle?.completedPromotionCycles ?? null,
    promotionCycleBucket: promotionCycleBucket(result.promotionCycle),
  };
}

/**
 * Composes the full Commander read model for ONE officer — the exact same
 * computation `getCommanderQueryDataset()` runs per-row. Exported so other
 * single-officer consumers (Phase 44's Officer Intelligence View Model) can
 * reuse it instead of re-deriving age/service/promotion/retirement/timeline
 * values independently.
 */
export function toQueryOfficer(
  officer: OfficerWithRelations,
  asOf: Date,
  orgLabels: { company: string | null },
  officialPortraitUrl: string | null
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
  const eligibilityOfficer = buildEligibilityOfficer(
    officer,
    positionLevel,
    yearsInPositionLevel,
    yearsInRank,
    governmentServiceYears,
    retirementRemainingMonths
  );
  const nextLevelEligibility = computeNextLevelEligibility(eligibilityOfficer, asOf);
  const promotionIntelligence = computePromotionSummary(intelligence, eligibilityOfficer, asOf);
  // Phase 42 UI refinement: exact (never decimal) government-service duration
  // for the Commander Dashboard's Promotion Priority list "อายุราชการ"
  // column — Service Intelligence facade, unmodified, not previously
  // consumed by this read model (governmentServiceYears above remains the
  // Phase 40A decimal compatibility field).
  const serviceSummary = computeServiceSummary(officer, asOf);
  // Commander Promotion UX refinement: exact years+months age for the
  // rebuilt Commander Search results table — Age Intelligence facade,
  // unmodified (ageYears below remains the Phase 40A decimal compatibility
  // field, unchanged).
  const ageSummary = computeAgeSummary(officer.dateOfBirth ?? null, asOf);
  // Phase 44.1 fix: commander-facing YEAR COUNT (Buddhist-Era calendar-year
  // subtraction), not an exact elapsed duration — see positionLevelYearCount's
  // doc comment on CommanderQueryOfficer.
  const positionLevelStartYearBe = positionLevelStart ? toBuddhistEraYear(positionLevelStart.getUTCFullYear()) : null;
  const positionLevelYearCount = yearCountSince(positionLevelStartYearBe, toBuddhistEraYear(asOf.getUTCFullYear()));
  // Phase 45: Training Intelligence, evaluated against the officer's NEXT
  // position level (the same target Promotion Intelligence evaluates) —
  // reports NoPolicy/NoData truthfully since no real TrainingPolicy exists yet.
  const trainingIntelligence = computeTrainingSummary(officer.training, promotionIntelligence.targetPosition, asOf);
  // Phase 49A: computed ONCE here from the same officer.documents already
  // loaded by loadCommanderOfficerProfiles()'s bulk query — never a
  // second per-officer fetch, never recomputed separately by the
  // dashboard/search/table (all three read this same field).
  const documentIntelligence = composeOfficerDocumentIntelligence({
    officerId: officer.officerId,
    officerPk: officer.id,
    documents: officer.documents,
    asOf,
  });
  const documentExpiryInfo = computeExpiryInfo(officer.documents, asOf);

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
    positionLevelYearCount,
    completedPromotionCycles: nextLevelEligibility?.completedPromotionCycles ?? null,
    appointmentCycle,
    governmentServiceYears,
    ageYears: yearsFromDuration(calculateAge(officer.dateOfBirth ?? null, asOf)),
    retirementYear: retirement?.retirementDate.getUTCFullYear() ?? null,
    retirementYearBe: retirement ? toBuddhistEraYear(retirement.retirementDate.getUTCFullYear()) : null,
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
    // Phase 45.1: privacy-safe Master Data fields exposed for Commander
    // Search filtering (Task 9) — deliberately excludes salary/bank; those
    // stay out of CommanderQueryOfficer entirely so they can never leak
    // into the results table, CSV export, or any drilldown built on this type.
    academyClass: officer.academyClass ?? null,
    isGpfMember: officer.isGpfMember ?? null,
    isCooperativeMember: officer.isCooperativeMember ?? null,
    cooperativeName: officer.cooperativeName ?? null,
    eligibleTwoStep: twoStepEvaluation.status === SalaryEligibilityStatus.Eligible,
    mustSkipStep: twoStepEvaluation.status === SalaryEligibilityStatus.NotEligible,
    skillSignals: toSkillSignals(officer.skills ?? [], asOf),
    nextLevelEligibility,
    promotionIntelligence,
    trainingIntelligence,
    displayServiceDurationTh: serviceSummary.available ? serviceSummary.displayServiceDurationTh : null,
    positionLevelStartYearBe,
    displayAgeYearsMonthsTh: ageSummary.available ? formatAgeYearsMonthsTh(ageSummary.exactAge) : null,
    dateOfBirth: officer.dateOfBirth ?? null,
    eligibleCycle: nextLevelEligibility?.eligibleCycle ?? null,
    overdueCycles: nextLevelEligibility?.overdueCycles ?? 0,
    promotionCycleBucket: nextLevelEligibility?.promotionCycleBucket ?? "not_eligible",
    thumbnailUrl: officer.thumbnailUrl,
    driveFileId: officer.driveFileId,
    webViewUrl: officer.webViewUrl,
    officialPortraitUrl,
    documentIntelligence,
    documentExpiryInfo,
  };
}
