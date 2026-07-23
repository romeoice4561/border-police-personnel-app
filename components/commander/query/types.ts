import type { CommanderQueryOfficer, NumericOperator } from "@/lib/commander_query/types";
import type { OfficerFlagCode, OfficerPriority, PromotionStatus } from "@/lib/intelligence";
import type { EligibilityStatus } from "@/lib/promotion/eligibility_policy";
import type { SkillFilter } from "@/lib/capability/skill_filter";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { TrainingStatus } from "@/lib/intelligence/training/types";
import type { DocumentIntelligenceFilters } from "@/lib/integration/navigation/document_filter_types";

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

export interface CommanderQueryFilters extends DocumentIntelligenceFilters {
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
  /** Phase 42: filters on the richer Promotion Intelligence status (lib/intelligence/promotion's PromotionEligibilityStatus) — distinct from the legacy `promotionStatus` score-ratio filter above; used by Commander Dashboard drill-down links (e.g. `?promotionStatus=AlreadyEligible` maps here, not to the legacy field). */
  promotionEligibilityStatus?: PromotionEligibilityStatus;
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
  /** Phase 44: capability filter (category / skill / min level / verified / certificate / deployment-ready / experience). */
  skill?: SkillFilter;
  /** Phase 42: Commander Dashboard retirement-awareness drill-down — matches officers retiring within the given horizon (cumulative: "within-1-year" is a subset of "within-3-years"). */
  retirementWithin?: "within-1-year" | "within-3-years" | "within-5-years";
  /** Phase 45: filters on TrainingSummary.trainingStatus (lib/intelligence/training) — used by the Commander Dashboard's "ขาดหลักสูตร"/Action Center drill-down links and the Commander Search training filter. */
  trainingStatus?: TrainingStatus;
  /** Phase 49.7: exact Buddhist-Era year the officer started their CURRENT position level — matches CommanderQueryOfficer.positionLevelStartYearBe exactly (the same canonical field the results table's "เริ่มดำรงระดับนี้" column already displays). */
  positionLevelStartYearBe?: number;
  /** Phase 49.7: exact Buddhist-Era year the officer FIRST qualifies for their next level — matches CommanderQueryOfficer.promotionIntelligence.firstEligibleFiscalYearBe (the PROJECTED field, computable even before the officer reaches eligibility). */
  firstEligibleYearBe?: number;
  /** Phase 49.8: matches CommanderQueryOfficer.promotionIntelligence.confidence exactly — "assessable" is a UI-only convenience meaning confidence === "confirmed"; "not-assessable" means confidence is "incomplete" or "unknown" (canonical field, no local recalculation — see applyFilters in commander_query_center.tsx). */
  promotionDataQuality?: "assessable" | "not-assessable";
  // ── Phase 45.1: Personnel Master Data filters (Task 9 — privacy-safe only) ──
  /** รุ่น นรต. — matches CommanderQueryOfficer.academyClass exactly. */
  academyClass?: number;
  /** สมาชิก กบข. — tri-state: true/false match exactly; omitted means "any" (never filters out "unspecified" implicitly). */
  isGpfMember?: boolean;
  /** สมาชิกสหกรณ์. */
  isCooperativeMember?: boolean;
  /** ชื่อสหกรณ์ — case-insensitive substring match, mirrors other free-text filters. */
  cooperativeName?: string;
}

export interface DrilldownFilter {
  field: keyof Pick<CommanderQueryOfficer, "rank" | "positionLevel" | "companyLabel" | "retirementYear">;
  value: string | number | null;
  label: string;
}
