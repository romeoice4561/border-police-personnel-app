import type { CommanderQueryOfficer, NumericOperator } from "@/lib/commander_query/types";
import type { OfficerFlagCode, OfficerPriority, PromotionStatus } from "@/lib/intelligence";
import type { EligibilityStatus } from "@/lib/promotion/eligibility_policy";

export type CommanderSortField =
  | "rank"
  | "displayName"
  | "currentPosition"
  | "positionLevel"
  | "yearsInRank"
  | "yearsInPosition"
  | "governmentServiceYears"
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
  /** Phase 41 Part 3: filter on years held at the current structured position level (Completed 0–5+ × operator). */
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
