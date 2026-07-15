import type { PromotionCycleResult } from "@/lib/promotion_cycle/types";

/** Eligible-since cycle number, e.g. "2568". */
export function formatEligibleSinceCycle(eligibleCycle: number | null | undefined): string | null {
  if (eligibleCycle == null) return null;
  return String(eligibleCycle);
}

/** Appointment cycle number, e.g. "2564". */
export function formatAppointmentCycle(cycle: number | null | undefined): string | null {
  if (cycle == null) return null;
  return String(cycle);
}

/** Completed cycles as a plain count, e.g. "5". */
export function formatCompletedCyclesCount(cycles: number | null | undefined): string | null {
  if (cycles == null) return null;
  return String(cycles);
}

/** Human-readable completed appointment cycles, e.g. "5 วาระ". */
export function formatCompletedCycles(cycles: number | null | undefined): string | null {
  if (cycles == null) return null;
  return `${cycles} วาระ`;
}

/** Eligible overdue in police promotion terms, e.g. "2 Years". */
export function formatEligibleOverdueYears(overdueCycles: number): string | null {
  if (overdueCycles <= 1) return null;
  return `${overdueCycles} Year${overdueCycles === 1 ? "" : "s"}`;
}

/**
 * Promotion status while eligible/overdue, e.g. "ครบขึ้นปีที่ 2".
 * Year 1 = first eligible cycle; year 2 = one cycle after eligibility began.
 */
export function formatPromotionOverdueLabel(overdueCycles: number): string | null {
  if (overdueCycles <= 0) return null;
  return `ครบขึ้นปีที่ ${overdueCycles}`;
}

/** Ready-for-promotion headline, e.g. "ครบขึ้นผู้กำกับการ". */
export function formatReadyForLevelLabel(targetLevel: string): string {
  return `ครบขึ้น${targetLevel}`;
}

export function formatPromotionCycleSummary(
  cycle: PromotionCycleResult | null,
  targetLevel: string | null
): {
  readyLabel: string | null;
  eligibleSinceLabel: string | null;
  statusLabel: string | null;
  completedLabel: string | null;
} {
  if (!cycle || !targetLevel) {
    return { readyLabel: null, eligibleSinceLabel: null, statusLabel: null, completedLabel: formatCompletedCycles(cycle?.completedPromotionCycles) };
  }
  return {
    readyLabel: cycle.eligibleNow ? formatReadyForLevelLabel(targetLevel) : null,
    eligibleSinceLabel: formatEligibleSinceCycle(cycle.eligibleSince),
    statusLabel: formatPromotionOverdueLabel(cycle.overdueCycles) ?? formatEligibleOverdueYears(cycle.overdueCycles),
    completedLabel: formatCompletedCycles(cycle?.completedPromotionCycles),
  };
}
