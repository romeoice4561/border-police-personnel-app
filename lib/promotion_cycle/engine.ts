import { yearGregorianToBE } from "@/lib/officer_profile/thai_date";
import type { PromotionCycleInput, PromotionCyclePolicy, PromotionCycleResult } from "@/lib/promotion_cycle/types";

export const DEFAULT_PROMOTION_CYCLE_POLICY: PromotionCyclePolicy = { requiredCycles: 4 };

export function currentPromotionCycle(now: Date = new Date()): number {
  return yearGregorianToBE(now.getUTCFullYear());
}

export function appointmentCycleFromDate(date: Date | null | undefined): number | null {
  if (!date) return null;
  return yearGregorianToBE(new Date(date).getUTCFullYear());
}

export function evaluatePromotionCycle(input: PromotionCycleInput): PromotionCycleResult {
  const currentCycle = input.currentCycle ?? currentPromotionCycle();
  const appointmentCycle = input.appointmentCycle ?? appointmentCycleFromDate(input.appointmentDate);
  if (appointmentCycle == null) {
    return {
      appointmentCycle: null,
      completedPromotionCycles: null,
      eligibleCycle: null,
      overdueCycles: 0,
      yearsAfterEligibility: null,
      eligibleSince: null,
      eligibleNow: false,
    };
  }

  const eligibleCycle = appointmentCycle + input.policy.requiredCycles;
  const eligibleNow = currentCycle >= eligibleCycle;
  const yearsAfterEligibility = eligibleNow ? currentCycle - eligibleCycle : null;
  return {
    appointmentCycle,
    completedPromotionCycles: Math.max(0, currentCycle - appointmentCycle),
    eligibleCycle,
    overdueCycles: eligibleNow ? currentCycle - eligibleCycle + 1 : 0,
    yearsAfterEligibility,
    eligibleSince: eligibleNow ? eligibleCycle : null,
    eligibleNow,
  };
}
