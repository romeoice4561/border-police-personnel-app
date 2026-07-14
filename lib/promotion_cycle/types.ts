export interface PromotionCyclePolicy {
  requiredCycles: number;
}

export interface PromotionCycleInput {
  appointmentCycle?: number | null;
  appointmentDate?: Date | null;
  currentCycle?: number;
  policy: PromotionCyclePolicy;
}

export interface PromotionCycleResult {
  appointmentCycle: number | null;
  completedPromotionCycles: number | null;
  eligibleCycle: number | null;
  overdueCycles: number;
  yearsAfterEligibility: number | null;
  eligibleSince: number | null;
}
