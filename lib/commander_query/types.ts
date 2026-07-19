import type { OfficerFlag, OfficerFlagCode, OfficerPriority, PromotionStatus, RetirementStatus } from "@/lib/intelligence";
import type { EligibilityStatus } from "@/lib/promotion/eligibility_policy";
import type { OfficerSkillSignal, SkillCatalog } from "@/lib/capability/capability_types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";

export type NumericOperator = "exactly" | "at_least" | "more_than" | "less_than";

export type CommanderChartKind = "rank" | "positionLevel" | "company";

/**
 * Phase 41 Part 2–4: a compact, precomputed summary of an officer's
 * eligibility to advance to the NEXT position level — computed once by the
 * read model (via lib/promotion/eligibility_policy) so Commander Search,
 * summary cards and presets can filter/count client-side without re-running
 * the engine per keystroke. Null when the officer is at Unknown / the top of
 * scope / a level with no configured policy.
 */
export interface CommanderEligibilitySummary {
  targetLevel: string;
  status: EligibilityStatus;
  eligibleNow: boolean;
  monthsUntilEligible: number | null;
  overdueYears: number;
  appointmentCycle: number | null;
  eligibleCycle: number | null;
  overdueCycles: number;
  completedPromotionCycles: number | null;
  promotionCycleBucket: "not_eligible" | "eligible_this_cycle" | "eligible_year_1" | "eligible_year_2" | "eligible_year_3" | "eligible_year_4" | "eligible_more_than_5";
}

export interface CommanderQueryOfficer {
  officerId: string;
  rank: string;
  firstName: string;
  lastName: string;
  displayName: string;
  currentPosition: string | null;
  positionLevel: string | null;
  currentUnit: string | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  companyLabel: string;
  yearsInRank: number | null;
  yearsInPosition: number | null;
  /**
   * @deprecated Phase 41 Part 3 field — an EXACT elapsed decimal-years
   * duration (`yearsSince`, chronological, can truncate to N-1 depending on
   * whether the current month/day has passed the anniversary). Still feeds
   * `EligibilityOfficer.yearsInPositionLevel` (Promotion Intelligence's
   * tenure-requirement check) unchanged — do not repurpose for display. For
   * the commander-facing "จำนวนปีในระดับนี้"/"ดำรงตำแหน่งระดับนี้มา" YEAR
   * COUNT, use `positionLevelYearCount` instead (Phase 44.1).
   */
  yearsInPositionLevel: number | null;
  /**
   * Phase 44.1 (position-level year-count fix): the commander-facing YEAR
   * COUNT for how long the officer has held their CURRENT structured
   * position level — `currentYearBe - positionLevelStartYearBe`, a
   * Buddhist-Era calendar-year subtraction, never an exact elapsed
   * duration and never `+1`. Distinct from the deprecated
   * `yearsInPositionLevel` above (an exact decimal duration) and from
   * `promotionIntelligence.promotionCyclesPassed` (an appointment-cycle
   * approximation) — this field must be the ONLY source for
   * "จำนวนปีในระดับนี้"/"ดำรงตำแหน่งระดับนี้มา" display text everywhere
   * (Commander Search table, Officer Intelligence Workspace). Null when
   * `positionLevelStartYearBe` is unavailable — never a fabricated 0.
   */
  positionLevelYearCount: number | null;
  /** Phase 42B: completed appointment cycles at the current position level (from PromotionCycleEngine). */
  completedPromotionCycles: number | null;
  governmentServiceYears: number | null;
  ageYears: number | null;
  /** Gregorian-labeled fiscal year — internal/technical value, used for filtering and drilldown matching. Never render this directly; use retirementYearBe for display. */
  retirementYear: number | null;
  /** Phase 40B: Buddhist-Era retirement fiscal year, e.g. 2588 — the value to render in charts/labels. */
  retirementYearBe: number | null;
  promotionStatus: PromotionStatus;
  retirementStatus: RetirementStatus;
  priority: OfficerPriority;
  profileCompletenessPercent: number | null;
  flags: OfficerFlag[];
  flagCodes: OfficerFlagCode[];
  hasGp7: boolean;
  hasOfficialPortrait: boolean;
  hasTraining: boolean;
  hasDocuments: boolean;
  /**
   * Phase 45.1: privacy-safe Master Data fields (Task 9) — salary/bank
   * fields are deliberately NOT part of this type; see
   * docs/PERSONNEL_MASTER_DATA_STANDARD.md's Commander Search Exposure
   * section.
   */
  academyClass: number | null;
  isGpfMember: boolean | null;
  isCooperativeMember: boolean | null;
  cooperativeName: string | null;
  /** Phase 41 Part 5: precomputed salary-step signals (reused from career_salary_engine) so the "ผู้มีสิทธิ์ 2 ขั้น" / "ผู้ต้องเว้นขั้น" presets can filter without a separate subsystem. */
  eligibleTwoStep: boolean;
  mustSkipStep: boolean;
  /** Phase 44: precomputed skill signals for the capability filter (empty when the officer has no recorded skills). */
  skillSignals: OfficerSkillSignal[];
  /** Phase 41 Part 2–4: precomputed next-level promotion eligibility (null when not applicable — Unknown level / top of scope / no policy). */
  nextLevelEligibility: CommanderEligibilitySummary | null;
  /**
   * Phase 41 (Promotion Intelligence Engine): the full WHY-explaining
   * promotion summary — expanded status, first-eligible date, exact
   * eligible duration, promotion-cycles-passed estimate, Thai display
   * text, and 0-100 priority score. Additive alongside `nextLevelEligibility`
   * above (unchanged) and `promotionStatus` (unchanged) — this is the
   * richer engine output, not a replacement for either.
   */
  promotionIntelligence: PromotionSummary;
  /**
   * Phase 45 (Training Intelligence Engine): the full training summary —
   * evidence, required-course evaluation (when a real policy is
   * configured), status, and Thai display text. `trainingStatus` is
   * `NoPolicy`/`NoData` for every officer today since no real
   * TrainingPolicy is configured yet (see docs/TRAINING_INTELLIGENCE.md) —
   * never fabricated as `MissingRequired`.
   */
  trainingIntelligence: TrainingSummary;
  /**
   * Phase 42 (Commander Dashboard Intelligence): the officer's date of
   * birth, exposed so the Dashboard View Model can compute Age/Retirement
   * Intelligence (`computeAgeSummary`/`computeRetirementSummary`) from this
   * SAME already-loaded dataset instead of a second Prisma round-trip.
   * Master data (Gregorian `Date`, per the ISO storage policy) — never
   * rendered directly; always go through the Intelligence facades for
   * display.
   */
  dateOfBirth: Date | null;
  /** Phase 42 UI refinement: exact (never decimal) government-service duration, e.g. "16 ปี 1 เดือน 3 วัน" — Service Intelligence (lib/intelligence/service), unmodified. Null when unavailable (see ServiceSummary.available). */
  displayServiceDurationTh: string | null;
  /**
   * Commander Promotion UX refinement: the Buddhist-Era year the officer
   * started their CURRENT structured position level ("ดำรงตำแหน่งนี้มาตั้งแต่ปี")
   * — derived from Timeline Intelligence (the earliest timeline row at the
   * current level, already computed as `positionLevelStart` in
   * lib/server/commander_query_service.ts), NOT the appointment-cycle
   * value. Null when the level is Unknown or undated.
   */
  positionLevelStartYearBe: number | null;
  /** Commander Promotion UX refinement: exact age as "40 ปี, 11 เดือน" (years + months, no days — matching the requested display precision) — from Age Intelligence (lib/intelligence/age), unmodified. Never decimal. Null when unavailable. */
  displayAgeYearsMonthsTh: string | null;
  appointmentCycle: number | null;
  eligibleCycle: number | null;
  overdueCycles: number;
  promotionCycleBucket: CommanderEligibilitySummary["promotionCycleBucket"];
  /** @deprecated SYSTEMATICALLY UNRELIABLE (Phase 23B) — never render directly. Use officialPortraitUrl. Kept only for back-compat callers. */
  thumbnailUrl: string | null;
  /** @deprecated see thumbnailUrl. */
  driveFileId: string | null;
  /** @deprecated see thumbnailUrl. */
  webViewUrl: string | null;
  /**
   * Phase 43: the resolved Official Portrait URL, batch-resolved once in
   * getCommanderQueryDataset() via the canonical resolver
   * (lib/server/officer_portrait_service.ts, resolveOfficerPortraitsBatch).
   * Null when no trusted portrait is linked (caller shows a placeholder).
   * This is the ONLY portrait field UI components should render.
   */
  officialPortraitUrl: string | null;
}

export interface CommanderQueryOptions {
  ranks: string[];
  positionLevels: string[];
  regions: Array<{ id: number; label: string }>;
  battalions: Array<{ id: number; regionId: number | null; label: string }>;
  companies: Array<{ id: number; battalionId: number | null; label: string }>;
  priorities: OfficerPriority[];
  /** Phase 44: the active skill catalog (categories + skills + levels) for the capability filter dropdowns. */
  skillCatalog: SkillCatalog;
}

export interface CommanderQueryDataset {
  officers: CommanderQueryOfficer[];
  options: CommanderQueryOptions;
}
