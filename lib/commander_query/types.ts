import type { OfficerFlag, OfficerFlagCode, OfficerPriority, PromotionStatus, RetirementStatus } from "@/lib/intelligence";
import type { EligibilityStatus } from "@/lib/promotion/eligibility_policy";

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
  /** Phase 41 Part 3: years the officer has held their CURRENT structured position level (from the earliest timeline row at that level). Null when the level is Unknown or undated. */
  yearsInPositionLevel: number | null;
  governmentServiceYears: number | null;
  ageYears: number | null;
  retirementYear: number | null;
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
  /** Phase 41 Part 5: precomputed salary-step signals (reused from career_salary_engine) so the "ผู้มีสิทธิ์ 2 ขั้น" / "ผู้ต้องเว้นขั้น" presets can filter without a separate subsystem. */
  eligibleTwoStep: boolean;
  mustSkipStep: boolean;
  /** Phase 41 Part 2–4: precomputed next-level promotion eligibility (null when not applicable — Unknown level / top of scope / no policy). */
  nextLevelEligibility: CommanderEligibilitySummary | null;
  appointmentCycle: number | null;
  eligibleCycle: number | null;
  overdueCycles: number;
  promotionCycleBucket: CommanderEligibilitySummary["promotionCycleBucket"];
  thumbnailUrl: string | null;
  driveFileId: string | null;
  webViewUrl: string | null;
}

export interface CommanderQueryOptions {
  ranks: string[];
  positionLevels: string[];
  regions: Array<{ id: number; label: string }>;
  battalions: Array<{ id: number; regionId: number | null; label: string }>;
  companies: Array<{ id: number; battalionId: number | null; label: string }>;
  priorities: OfficerPriority[];
}

export interface CommanderQueryDataset {
  officers: CommanderQueryOfficer[];
  options: CommanderQueryOptions;
}
