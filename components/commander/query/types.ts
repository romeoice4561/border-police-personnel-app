import type { CommanderQueryOfficer, NumericOperator } from "@/lib/commander_query/types";
import type { OfficerFlagCode, OfficerPriority, PromotionStatus } from "@/lib/intelligence";
import type { EligibilityStatus } from "@/lib/promotion/eligibility_policy";

export type CommanderSortField =
  | "rank"
  | "displayName"
  | "currentPosition"
  | "positionLevel"
  | "appointmentCycle"
  | "completedPromotionCycles"
  | "eligibleCycle"
  | "overdueCycles"
  | "ageYears"
  | "promotionStatus"
  | "retirementStatus"
  | "priority";

export interface NumericFilter {
  operator: NumericOperator;
  value: number;
}

export interface CommanderQueryFilters {
  rank?: string;
  currentPosition?: string;
  positionLevel?: string;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  yearsInRank?: NumericFilter;
  yearsInPosition?: NumericFilter;
  /** Phase 42B: filter on completed appointment cycles (PromotionCycleEngine). */
  completedPromotionCycles?: NumericFilter;
  /** Phase 42B: filter on appointment cycle at current position level. */
  appointmentCycle?: NumericFilter;
  /** Legacy decimal-year filter — hidden from primary UI. */
  yearsInPositionLevel?: NumericFilter;
  age?: NumericFilter;
  governmentServiceYears?: NumericFilter;
  promotionStatus?: PromotionStatus;
  flagCode?: OfficerFlagCode;
  priority?: OfficerPriority;
  minProfileCompleteness?: number;
  // ── Phase 41 Part 2: Promotion Eligibility Search ──
  /** Current rank → target rank (both optional; matches officers currently at `fromRank` — target is advisory context for the commander, not a stored field). */
  fromRank?: string;
  toRank?: string;
  /** Current position level → target position level. `toPositionLevel` matches officers whose NEXT-level eligibility targets it. */
  fromPositionLevel?: string;
  toPositionLevel?: string;
  /** Restrict to officers whose next-level eligibility has this status (eligible_now / eligible_soon / overdue / not_eligible). */
  eligibilityStatus?: EligibilityStatus;
  /** Phase 42B: true when the officer is ready for promotion (eligible this cycle or overdue). Matches summary card counts. */
  readyForPromotion?: boolean;
  promotionCycleBucket?: CommanderQueryOfficer["promotionCycleBucket"];
  // ── Phase 41 Part 5: boolean preset toggles (reuse precomputed signals) ──
  /** Only officers eligible for a two-step salary result this year. */
  eligibleTwoStepOnly?: boolean;
  /** Only officers who must skip a step (would otherwise be 3 consecutive 2.0). */
  mustSkipStepOnly?: boolean;
  /** Only officers missing an active ก.พ.7 (GP7) document. */
  missingGp7Only?: boolean;
}

export interface DrilldownFilter {
  field: keyof Pick<CommanderQueryOfficer, "rank" | "positionLevel" | "companyLabel" | "retirementYear">;
  value: string | number | null;
  label: string;
}
