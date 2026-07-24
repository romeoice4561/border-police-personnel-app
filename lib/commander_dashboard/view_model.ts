/**
 * Commander Dashboard View Model — pure composition (Phase 42).
 *
 * Turns already-computed Intelligence Engine outputs (`PromotionSummary`
 * from lib/intelligence/promotion, `AgeSummary`/`RetirementSummary` from
 * lib/intelligence/{age,retirement}) into the Dashboard-ready shapes in
 * lib/commander_dashboard/types.ts. This module does NOT calculate
 * promotion eligibility, age, retirement dates, or fiscal years itself —
 * every date/duration/status value here is read from an Intelligence
 * Engine summary already passed in. See
 * docs/COMMANDER_DASHBOARD_INTELLIGENCE.md for the full data-flow.
 *
 * Pure — no I/O, no React, no database. Deterministic given an explicit
 * `asOf` (defaults to `new Date()` only at the call sites in
 * lib/server/commander_dashboard_service.ts).
 */

import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { formatExactDurationTh } from "@/lib/intelligence/shared/exact_duration";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import { computeAgeSummary } from "@/lib/intelligence/age";
import { computeRetirementSummary } from "@/lib/intelligence/retirement";
import { fiscalYearStart } from "@/lib/personnel_calendar";
import { yearBEToGregorian } from "@/lib/officer_profile/thai_date";
import type { AgeSummary, PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";
import { hasTrainingPolicyForTargetLevel } from "@/lib/intelligence/training/policy";
import { buildTrainingPriorityList, type TrainingPriorityInput } from "@/lib/intelligence/training/priority";
import type {
  BirthdayOfficerViewModel,
  CommanderActionItemViewModel,
  CommanderDashboardViewModel,
  PromotionCandidateViewModel,
  RetirementOfficerViewModel,
} from "@/lib/commander_dashboard/types";

/** The minimal officer shape this module needs — a projection any caller (the real server service, or a test) can build without touching Prisma. Mirrors the fields commander_dashboard_service.ts already has on CommanderQueryOfficer. */
export interface DashboardSourceOfficer {
  officerId: string;
  displayName: string;
  rank: string | null;
  currentPosition: string | null;
  currentUnit: string | null;
  /** @deprecated gallery/legacy thumbnail — kept for backward compatibility. See officialPortraitUrl. */
  thumbnailUrl: string | null;
  /** The officer's resolved Official Portrait URL (resolved once, batched, by the caller via lib/server/officer_portrait_service.ts) — null when none is trusted. */
  officialPortraitUrl: string | null;
  dateOfBirth: Date | null;
  promotionStatus: PromotionEligibilityStatus;
  displayStatusTh: string;
  displayEligibleSinceTh: string | null;
  eligibleDate: string | null;
  /** Buddhist-Era fiscal year the officer FIRST became eligible — from PromotionSummary.eligibleFiscalYearBe, unchanged/unmodified. */
  eligibleFiscalYearBe: number | null;
  yearsEligible: number | null;
  monthsEligible: number | null;
  daysEligible: number | null;
  /**
   * Completed waiting years after eligibility (first cycle = 0) — from
   * PromotionSummary.overdueYears. Not the year ordinal.
   */
  overdueYears: number | null;
  /**
   * One-based eligibility-year ordinal (1 = first eligible year) — from
   * PromotionSummary.eligibleYearOrdinal. Distinct from overdueYears.
   */
  eligibleYearOrdinal: number | null;
  promotionCyclesPassed: number | null;
  priority: number | null;
  priorityReason: string | null;
  /** Exact government-service duration text — from Service Intelligence (lib/intelligence/service), unchanged/unmodified. */
  displayServiceDurationTh: string | null;
  /** Buddhist-Era retirement fiscal year — from Retirement Intelligence, unchanged/unmodified. */
  retirementYearBe: number | null;
  /** The officer's NEXT position level — from PromotionSummary.targetPosition, unchanged/unmodified. Null when unavailable. */
  targetPosition: string | null;
  /** @deprecated exact elapsed decimal-years duration (lib/commander_query/query_officer.ts's yearsInPositionLevel) — do not use for display; see positionLevelYearCount. */
  yearsInPositionLevel: number | null;
  /** Phase 44.1: the commander-facing YEAR COUNT for time at the current position level (currentYearBe - positionLevelStartYearBe) — from the Commander read model's positionLevelYearCount, unchanged/unmodified. Null when unavailable. */
  positionLevelYearCount: number | null;
  /** Phase 45: this officer's full TrainingSummary — from Training Intelligence (lib/intelligence/training), unchanged/unmodified. */
  training: TrainingSummary;
}

function officerHref(officerId: string): string {
  return `/officers/${encodeURIComponent(officerId)}`;
}

// ---------------------------------------------------------------------------
// Promotion Intelligence
// ---------------------------------------------------------------------------

/** Counts officers per PromotionEligibilityStatus — truthful, never fabricated: a status with zero officers today (because no policy configures that blocker yet) reports 0, not a hidden/omitted card. */
export function countPromotionStatuses(officers: readonly DashboardSourceOfficer[]) {
  const counts: Record<PromotionEligibilityStatus, number> = {
    EligibleThisYear: 0,
    AlreadyEligible: 0,
    Waiting: 0,
    MissingTraining: 0,
    MissingDocuments: 0,
    RetirementRestricted: 0,
    NotEligible: 0,
    Unknown: 0,
  };
  for (const officer of officers) counts[officer.promotionStatus] += 1;
  return counts;
}

/**
 * "1 ต.ค. 2568" — 1 October of the FIRST eligible fiscal year, from
 * PromotionSummary.eligibleFiscalYearBe (unmodified). Uses the existing,
 * unmodified `fiscalYearStart` primitive (lib/personnel_calendar/
 * fiscal_year.ts — `fiscalYearStart(fiscalYear) = 1 Oct of fiscalYear-1`)
 * — a presentation-layer re-anchoring of an already-computed fiscal year,
 * NOT a new business calculation. Never January or another arbitrary date.
 */
function computeFirstEligibleCycleDate(eligibleFiscalYearBe: number | null): Date | null {
  if (eligibleFiscalYearBe == null) return null;
  const gregorianFiscalYear = yearBEToGregorian(eligibleFiscalYearBe);
  return fiscalYearStart(gregorianFiscalYear);
}

/**
 * Builds the Promotion Priority list ("ผู้ควรได้รับการพิจารณาก่อน"), sorted
 * highest-priority first. Excludes officers whose `priority` is null — per
 * PromotionSummary's documented convention, `priority: null` means
 * "Unknown status, nothing to prioritize," not "priority zero." Does NOT
 * recompute the score; only formats fields already on PromotionSummary/
 * Service/Retirement Intelligence.
 */
export function buildPromotionPriorityCandidates(
  officers: readonly DashboardSourceOfficer[],
  limit?: number
): PromotionCandidateViewModel[] {
  const withPriority = officers.filter(
    (officer): officer is DashboardSourceOfficer & { priority: number } => officer.priority != null
  );
  const sorted = [...withPriority].sort((a, b) => b.priority - a.priority);
  const limited = limit != null ? sorted.slice(0, limit) : sorted;

  return limited.map((officer) => {
    const firstEligibleCycleDate = computeFirstEligibleCycleDate(officer.eligibleFiscalYearBe);
    const promotionYearOrdinal =
      officer.eligibleYearOrdinal != null && officer.eligibleYearOrdinal > 0 ? officer.eligibleYearOrdinal : null;

    return {
      officerId: officer.officerId,
      displayName: officer.displayName,
      rank: officer.rank,
      currentPosition: officer.currentPosition,
      currentUnit: officer.currentUnit,
      thumbnailUrl: officer.thumbnailUrl,
      officialPortraitUrl: officer.officialPortraitUrl,
      promotionStatus: officer.promotionStatus,
      displayStatusTh: officer.displayStatusTh,
      displayEligibleSinceTh: officer.displayEligibleSinceTh,
      displayEligibleFirstCycleTh: firstEligibleCycleDate ? formatShortThaiDateTh(firstEligibleCycleDate) : null,
      displayEligibleFiscalYearTh: officer.eligibleFiscalYearBe != null ? `(ปีงบประมาณ ${officer.eligibleFiscalYearBe})` : null,
      displayEligibleDurationTh:
        officer.yearsEligible != null && officer.monthsEligible != null && officer.daysEligible != null
          ? formatExactDurationTh({ years: officer.yearsEligible, months: officer.monthsEligible, days: officer.daysEligible })
          : null,
      promotionYearOrdinal,
      promotionCyclesPassed: officer.promotionCyclesPassed,
      displayPromotionCycleTh: officer.promotionCyclesPassed != null ? `รอบที่ ${officer.promotionCyclesPassed}` : null,
      displayServiceDurationTh: officer.displayServiceDurationTh,
      retirementYearBe: officer.retirementYearBe,
      displayRetirementYearTh: officer.retirementYearBe != null ? `พ.ศ. ${officer.retirementYearBe}` : null,
      // Phase 49.7 fix: this previously fired whenever a target level
      // existed on the officer, regardless of whether they had actually
      // reached eligibility — a "Waiting" officer with a high priority
      // score (e.g. from retirement proximity) could appear in this list
      // and incorrectly display "ครบขึ้น {target}" as if already qualified
      // (the same root-cause pattern as the reported Officer Profile
      // defect). Now gated on the officer genuinely being eligible.
      displayTargetQualificationTh:
        (officer.promotionStatus === "EligibleThisYear" || officer.promotionStatus === "AlreadyEligible") && officer.targetPosition != null
          ? `ครบขึ้น ${officer.targetPosition}`
          : null,
      displayYearsAtLevelTh: officer.positionLevelYearCount != null ? `${officer.positionLevelYearCount} ปี` : null,
      priority: officer.priority,
      priorityReason: officer.priorityReason,
      href: officerHref(officer.officerId),
    };
  });
}

// ---------------------------------------------------------------------------
// Birthday Intelligence
// ---------------------------------------------------------------------------

/**
 * "ครบ 41 ปี วันนี้" / "ครบ 38 ปี ในอีก 3 วัน" — the required display
 * examples from Task 5. Built from AgeSummary's already-computed
 * `nextBirthdayAge`/`daysUntilNextBirthday` fields; no age math here.
 */
function displayTurningAgeTh(age: AgeSummary): string {
  const turningAge = age.nextBirthdayAge;
  const daysUntil = age.daysUntilNextBirthday;
  if (turningAge == null || daysUntil == null) return "";
  if (daysUntil === 0) return `ครบ ${turningAge} ปี วันนี้`;
  return `ครบ ${turningAge} ปี ในอีก ${daysUntil} วัน`;
}

function toBirthdayViewModel(officer: DashboardSourceOfficer, age: AgeSummary): BirthdayOfficerViewModel | null {
  if (!age.available || !age.birthDate || !age.nextBirthdayDate || age.nextBirthdayAge == null || age.daysUntilNextBirthday == null) {
    return null;
  }
  return {
    officerId: officer.officerId,
    displayName: officer.displayName,
    rank: officer.rank,
    position: officer.currentPosition,
    unit: officer.currentUnit,
    profileImageUrl: officer.officialPortraitUrl,
    birthDate: age.birthDate,
    birthdayDateThisYear: age.nextBirthdayDate,
    turningAge: age.nextBirthdayAge,
    daysUntilBirthday: age.daysUntilNextBirthday,
    displayBirthdayTh: formatShortThaiDateTh(new Date(`${age.nextBirthdayDate}T00:00:00Z`)),
    displayTurningAgeTh: displayTurningAgeTh(age),
  };
}

export interface BirthdayIntelligenceResult {
  todayCount: number;
  nextSevenDaysCount: number;
  thisMonthCount: number;
  today: BirthdayOfficerViewModel[];
  nextSevenDays: BirthdayOfficerViewModel[];
  thisMonth: BirthdayOfficerViewModel[];
}

/**
 * Computes Birthday Intelligence for every officer with a usable AgeSummary.
 * "This month" spans the CURRENT calendar month (by `asOf`'s month), using
 * each officer's actual birth month/day — not `nextBirthdayDate`, since a
 * birthday earlier this month has already passed and would otherwise be
 * excluded by the forward-looking `daysUntilNextBirthday` field. Sort order
 * for "this month" per Task 5: today's birthdays first, then upcoming
 * (soonest first), then already-passed-this-month (most recent first).
 *
 * Overlap between "next 7 days" and "this month" is EXPECTED and not
 * deduplicated — Task 5 explicitly allows this; only the summary COUNTS
 * must not double-count within the same list.
 */
export function computeBirthdayIntelligence(
  officers: readonly DashboardSourceOfficer[],
  asOf: Date
): BirthdayIntelligenceResult {
  const asOfMonth = asOf.getUTCMonth();
  const asOfDay = asOf.getUTCDate();

  const today: BirthdayOfficerViewModel[] = [];
  const nextSevenDays: BirthdayOfficerViewModel[] = [];
  const thisMonthEntries: Array<{ vm: BirthdayOfficerViewModel; sortKey: number }> = [];

  for (const officer of officers) {
    if (!officer.dateOfBirth) continue;
    const age = computeAgeSummary(officer.dateOfBirth, asOf);
    const vm = toBirthdayViewModel(officer, age);
    if (!vm) continue;

    if (vm.daysUntilBirthday === 0) today.push(vm);
    if (vm.daysUntilBirthday >= 0 && vm.daysUntilBirthday <= 7) nextSevenDays.push(vm);

    // "This month" uses the BIRTH month/day directly (not nextBirthdayDate,
    // which may roll into next year for a birthday already passed this
    // month) so an already-passed birthday earlier this month is still
    // included, per Task 5's three-way sort requirement.
    const dob = officer.dateOfBirth;
    const birthMonth = dob.getUTCMonth();
    const birthDay = dob.getUTCDate();
    if (birthMonth !== asOfMonth) continue;

    if (birthDay >= asOfDay) {
      // Today or upcoming this month: sort ascending by day-of-month (today first).
      thisMonthEntries.push({ vm, sortKey: birthDay });
    } else {
      // Already passed earlier this month: sort so the MOST RECENT (closest
      // to today) comes first among the "already passed" group, placed
      // after all today/upcoming entries via the +1000 offset.
      thisMonthEntries.push({ vm, sortKey: 1000 - birthDay });
    }
  }

  thisMonthEntries.sort((a, b) => a.sortKey - b.sortKey);
  const thisMonth = thisMonthEntries.map((entry) => entry.vm);

  nextSevenDays.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);

  return {
    todayCount: today.length,
    nextSevenDaysCount: nextSevenDays.length,
    thisMonthCount: thisMonth.length,
    today,
    nextSevenDays,
    thisMonth,
  };
}

// ---------------------------------------------------------------------------
// Retirement Awareness
// ---------------------------------------------------------------------------

export interface RetirementAwarenessResult {
  withinOneYear: number;
  withinThreeYears: number;
  withinFiveYears: number;
  candidates: RetirementOfficerViewModel[];
}

/**
 * Computes Retirement Awareness for every officer with a usable
 * RetirementSummary, within a 5-year horizon. The three counts are
 * cumulative bands (an officer retiring in 8 months counts toward all
 * three), matching how a commander reads "within N years" — never
 * double-counted as separate mutually-exclusive buckets.
 */
export function computeRetirementAwareness(
  officers: readonly DashboardSourceOfficer[],
  asOf: Date,
  horizonYears = 5
): RetirementAwarenessResult {
  let withinOneYear = 0;
  let withinThreeYears = 0;
  let withinFiveYears = 0;
  const candidates: RetirementOfficerViewModel[] = [];

  for (const officer of officers) {
    if (!officer.dateOfBirth) continue;
    const retirement = computeRetirementSummary(officer.dateOfBirth, asOf);
    if (!retirement.available || retirement.isRetired || retirement.remainingDays == null) continue;

    const remainingYears = retirement.remainingDays / 365;
    if (remainingYears > horizonYears) continue;

    if (remainingYears <= 1) withinOneYear += 1;
    if (remainingYears <= 3) withinThreeYears += 1;
    if (remainingYears <= horizonYears) withinFiveYears += 1;

    const age = computeAgeSummary(officer.dateOfBirth, asOf);

    candidates.push({
      officerId: officer.officerId,
      displayName: officer.displayName,
      rank: officer.rank,
      currentUnit: officer.currentUnit,
      displayAgeTh: age.available ? age.displayAgeTh : null,
      remainingDays: retirement.remainingDays,
      displayRetirementDateTh: retirement.displayRetirementDateTh ?? "",
      displayRetirementYearTh: retirement.displayRetirementYearTh ?? "",
      displayRemainingTh: retirement.displayRemainingTh ?? "",
      promotionStatus: officer.promotionStatus === "Unknown" ? null : officer.promotionStatus,
      displayPromotionStatusTh: officer.promotionStatus === "Unknown" ? null : officer.displayStatusTh,
      href: officerHref(officer.officerId),
    });
  }

  candidates.sort((a, b) => a.displayRetirementDateTh.localeCompare(b.displayRetirementDateTh, "th"));

  return { withinOneYear, withinThreeYears, withinFiveYears, candidates };
}

// ---------------------------------------------------------------------------
// Action Center
// ---------------------------------------------------------------------------

/**
 * Consolidates urgent items into the Action Center. Birthdays are always
 * "info" severity (never inflated to high/medium) per Task 7 — a birthday
 * is informational, not an urgent problem. Zero-count categories are
 * omitted entirely (an empty Action Center is not itself an action item).
 */
export function buildActionCenter(input: {
  eligibleThisYearHighPriorityCount: number;
  retirementWithinOneYearCount: number;
  unknownPromotionCount: number;
  birthdayTodayCount: number;
  /** Phase 45: real MissingRequired training count only — never fires for NoPolicy/NoData (those are truthful non-issues, not action items). */
  trainingMissingRequiredCount?: number;
  trainingExpiredCount?: number;
  /** Phase 45 completion pass (Task 7B): officers whose training evidence is Unverified — a data-quality issue, not a policy blocker. */
  trainingUnverifiedCount?: number;
  /** Phase 45 completion pass (Task 7C): officers reporting NoPolicy — informational only, never presented as individual officer misconduct. */
  trainingNoPolicyCount?: number;
}): CommanderActionItemViewModel[] {
  const items: CommanderActionItemViewModel[] = [];

  if (input.eligibleThisYearHighPriorityCount > 0) {
    items.push({
      id: "promotion-priority",
      category: "PROMOTION_PRIORITY",
      severity: "high",
      title: "ครบคุณสมบัติสะสมและมี Priority สูง",
      description: "รายชื่อกำลังพลที่ควรได้รับการพิจารณาเลื่อนตำแหน่งก่อนเป็นลำดับแรก",
      count: input.eligibleThisYearHighPriorityCount,
      href: "/commander-search?promotionEligibilityStatus=AlreadyEligible",
    });
  }

  if (input.retirementWithinOneYearCount > 0) {
    items.push({
      id: "retirement-within-one-year",
      category: "RETIREMENT",
      severity: "medium",
      title: "ใกล้เกษียณ",
      description: "กำลังพลที่จะเกษียณอายุราชการภายใน 1 ปี",
      count: input.retirementWithinOneYearCount,
      href: "/commander-search?retirement=within-1-year",
    });
  }

  if (input.unknownPromotionCount > 0) {
    items.push({
      id: "unknown-promotion-data",
      category: "DATA_QUALITY",
      severity: "medium",
      title: "ข้อมูลที่ไม่สามารถวิเคราะห์ได้",
      description: "กำลังพลที่ยังไม่สามารถประเมินสถานะการเลื่อนตำแหน่งได้ เนื่องจากข้อมูลไม่เพียงพอ",
      count: input.unknownPromotionCount,
      href: "/commander-search?promotionEligibilityStatus=Unknown",
    });
  }

  if (input.birthdayTodayCount > 0) {
    items.push({
      id: "birthday-today",
      category: "BIRTHDAY",
      severity: "info",
      title: "วันเกิดวันนี้",
      description: "กำลังพลที่มีวันเกิดในวันนี้",
      count: input.birthdayTodayCount,
      href: "/dashboard?birthday=today",
    });
  }

  // Phase 45: real MissingRequired/Expired training conditions only — a
  // NoPolicy/NoData officer NEVER contributes to either count (see
  // composeCommanderDashboardViewModel's trainingCounts), so this item is
  // structurally absent today (both counts are 0 with no configured policy)
  // and only appears once a real TrainingPolicy makes it truthful.
  if (input.trainingMissingRequiredCount && input.trainingMissingRequiredCount > 0) {
    items.push({
      id: "training-missing-required",
      category: "TRAINING",
      severity: "medium",
      title: "ขาดหลักสูตรที่จำเป็น",
      description: "กำลังพลที่ยังขาดหลักสูตรที่จำเป็นตามนโยบาย",
      count: input.trainingMissingRequiredCount,
      href: "/commander-search?trainingStatus=MissingRequired",
    });
  }

  if (input.trainingExpiredCount && input.trainingExpiredCount > 0) {
    items.push({
      id: "training-expired",
      category: "TRAINING",
      severity: "medium",
      title: "มีหลักสูตรหมดอายุ",
      description: "กำลังพลที่มีหลักสูตรจำเป็นหมดอายุแล้ว ควรอบรมทบทวน",
      count: input.trainingExpiredCount,
      href: "/commander-search?trainingStatus=Expired",
    });
  }

  // Task 7B: real data-quality issue (Unverified training evidence) — a
  // caveat about data trustworthiness, not a promotion blocker. Medium
  // severity, matching the DATA_QUALITY entry's precedent above.
  if (input.trainingUnverifiedCount && input.trainingUnverifiedCount > 0) {
    items.push({
      id: "training-data-quality",
      category: "TRAINING",
      severity: "medium",
      title: "ข้อมูลการฝึกอบรมควรตรวจสอบ",
      description: "กำลังพลที่มีข้อมูลหลักสูตรซึ่งยังไม่ผ่านการตรวจสอบ",
      count: input.trainingUnverifiedCount,
      href: "/commander-search?trainingStatus=Unverified",
    });
  }

  // Task 7C: NoPolicy is informational ONLY — never implies any individual
  // officer is at fault, never the same severity as a real blocker. Shown
  // so a commander understands WHY the training KPI/filters can't yet
  // report a real missing-required count, not as an alert about people.
  if (input.trainingNoPolicyCount && input.trainingNoPolicyCount > 0) {
    items.push({
      id: "training-no-policy",
      category: "TRAINING",
      severity: "info",
      title: "ยังไม่ได้กำหนดนโยบายหลักสูตร",
      description: "ยังไม่สามารถประเมินหลักสูตรที่จำเป็นต่อการเลื่อนตำแหน่งได้ เนื่องจากยังไม่ได้กำหนดนโยบาย",
      count: input.trainingNoPolicyCount,
      href: null,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Full view model composition
// ---------------------------------------------------------------------------

export interface ComposeDashboardViewModelOptions {
  priorityListLimit?: number;
  retirementHorizonYears?: number;
}

/**
 * Composes the full CommanderDashboardViewModel from a list of source
 * officers (already carrying PromotionSummary fields — see
 * DashboardSourceOfficer) plus a deterministic `asOf`. This is the ONE
 * function `lib/server/commander_dashboard_service.ts` calls; it contains
 * no Prisma/I/O so it can be exercised directly in tests with synthetic
 * officers and a fixed date.
 */
export function composeCommanderDashboardViewModel(
  officers: readonly DashboardSourceOfficer[],
  asOf: Date,
  options: ComposeDashboardViewModelOptions = {}
): CommanderDashboardViewModel {
  const priorityListLimit = options.priorityListLimit ?? 10;
  const retirementHorizonYears = options.retirementHorizonYears ?? 5;

  const fiscalYear = computeFiscalYearSummary(asOf);
  const statusCounts = countPromotionStatuses(officers);
  const priorityCandidates = buildPromotionPriorityCandidates(officers, priorityListLimit);
  const birthdays = computeBirthdayIntelligence(officers, asOf);
  const retirement = computeRetirementAwareness(officers, asOf, retirementHorizonYears);

  const dataUnavailableCount = officers.filter((officer) => !officer.dateOfBirth).length;

  const highPriorityAlreadyEligible = officers.filter(
    (officer) => officer.promotionStatus === "AlreadyEligible" && (officer.priority ?? 0) >= 80
  ).length;

  // Phase 45: Training Intelligence counts — every officer's TrainingSummary
  // was already computed upstream (Training Intelligence, via
  // toQueryOfficer); this only tallies, never recalculates.
  const trainingCounts = {
    missingRequiredCount: officers.filter((o) => o.training.trainingStatus === "MissingRequired").length,
    expiredCount: officers.filter((o) => o.training.trainingStatus === "Expired").length,
    expiringSoonCount: officers.filter((o) => o.training.trainingStatus === "ExpiringSoon").length,
    unverifiedCount: officers.filter((o) => o.training.trainingStatus === "Unverified").length,
    noPolicyCount: officers.filter((o) => o.training.trainingStatus === "NoPolicy").length,
    noDataCount: officers.filter((o) => o.training.trainingStatus === "NoData").length,
    // Officers whose TrainingSummary itself could not be loaded/computed —
    // distinct from NoData (zero real records, a truthful zero) and NoPolicy
    // (records exist, nothing to check them against). Always 0 today (the
    // engine's computeTrainingSummary never returns available: false for a
    // successfully-loaded officer) — kept as an explicit, honest field
    // rather than silently folding this case into NoData.
    unavailableCount: officers.filter((o) => !o.training.available).length,
    // True only when a real policy exists for at least one officer's target level.
    policyConfigured: officers.some((o) => o.targetPosition != null && hasTrainingPolicyForTargetLevel(o.targetPosition)),
    priorityOfficers: buildTrainingPriorityList(
      officers.map(
        (o): TrainingPriorityInput => ({
          officerId: o.officerId,
          displayName: o.displayName,
          rank: o.rank,
          position: o.currentPosition,
          unit: o.currentUnit,
          officialPortraitUrl: o.officialPortraitUrl,
          training: o.training,
          promotionEligible: o.promotionStatus === "EligibleThisYear" || o.promotionStatus === "AlreadyEligible",
          promotionStatusTh: o.displayStatusTh || null,
        })
      )
    ),
  };

  const actionCenter = buildActionCenter({
    eligibleThisYearHighPriorityCount: highPriorityAlreadyEligible,
    retirementWithinOneYearCount: retirement.withinOneYear,
    unknownPromotionCount: statusCounts.Unknown,
    birthdayTodayCount: birthdays.todayCount,
    trainingMissingRequiredCount: trainingCounts.missingRequiredCount,
    trainingExpiredCount: trainingCounts.expiredCount,
    trainingUnverifiedCount: trainingCounts.unverifiedCount,
    trainingNoPolicyCount: trainingCounts.noPolicyCount,
  });

  return {
    generatedAt: new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())).toISOString().slice(0, 10),
    fiscalYearBe: fiscalYear.fiscalYearBe,
    displayFiscalYearTh: fiscalYear.displayFiscalYearTh,

    personnelOverview: {
      totalPersonnel: officers.length,
      activePersonnel: officers.length,
      dataUnavailableCount,
    },

    promotion: {
      eligibleThisYear: statusCounts.EligibleThisYear,
      alreadyEligible: statusCounts.AlreadyEligible,
      waiting: statusCounts.Waiting,
      missingTraining: statusCounts.MissingTraining,
      missingDocuments: statusCounts.MissingDocuments,
      retirementRestricted: statusCounts.RetirementRestricted,
      unknown: statusCounts.Unknown,
      priorityCandidates,
    },

    birthdays: {
      todayCount: birthdays.todayCount,
      nextSevenDaysCount: birthdays.nextSevenDaysCount,
      thisMonthCount: birthdays.thisMonthCount,
      today: birthdays.today,
      nextSevenDays: birthdays.nextSevenDays,
      thisMonth: birthdays.thisMonth,
    },

    retirement: {
      withinOneYear: retirement.withinOneYear,
      withinThreeYears: retirement.withinThreeYears,
      withinFiveYears: retirement.withinFiveYears,
      candidates: retirement.candidates,
    },

    training: trainingCounts,

    actionCenter,
  };
}

