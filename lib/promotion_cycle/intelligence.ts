import type { PromotionCycleResult } from "@/lib/promotion_cycle/types";

export type PromotionCycleBucket =
  | "not_eligible"
  | "eligible_this_cycle"
  | "eligible_year_1"
  | "eligible_year_2"
  | "eligible_year_3"
  | "eligible_year_4"
  | "eligible_more_than_5";

/** Maps engine output to Commander Search filter buckets. */
export function promotionCycleBucket(cycle: PromotionCycleResult | null): PromotionCycleBucket {
  if (!cycle?.eligibleNow) return "not_eligible";
  if (cycle.overdueCycles === 1) return "eligible_this_cycle";
  if (cycle.overdueCycles === 2) return "eligible_year_2";
  if (cycle.overdueCycles === 3) return "eligible_year_3";
  if (cycle.overdueCycles === 4) return "eligible_year_4";
  return "eligible_more_than_5";
}

/** True when the officer is ready for promotion (eligible this cycle or overdue). */
export function isPromotionCycleReady(cycle: PromotionCycleResult | null): boolean {
  return cycle?.eligibleNow === true;
}

/** Normalize filter bucket aliases (Year 1 == this cycle). */
export function promotionCycleBucketMatches(
  officerBucket: PromotionCycleBucket,
  filterBucket: PromotionCycleBucket
): boolean {
  if (filterBucket === "eligible_year_1") return officerBucket === "eligible_this_cycle";
  return officerBucket === filterBucket;
}
