import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePromotionCycle } from "@/lib/promotion_cycle";
import { promotionCycleBucket, isPromotionCycleReady } from "@/lib/promotion_cycle/intelligence";
import { formatPromotionCycleSummary } from "@/lib/promotion_cycle/display";

test("appointment cycle 2564 becomes eligible in cycle 2568 and overdue year 2 in 2569", () => {
  const result = evaluatePromotionCycle({
    appointmentCycle: 2564,
    currentCycle: 2569,
    policy: { requiredCycles: 4 },
  });

  assert.equal(result.appointmentCycle, 2564);
  assert.equal(result.completedPromotionCycles, 5);
  assert.equal(result.eligibleCycle, 2568);
  assert.equal(result.eligibleSince, 2568);
  assert.equal(result.overdueCycles, 2);
  assert.equal(result.yearsAfterEligibility, 1);
  assert.equal(result.eligibleNow, true);
  assert.equal(promotionCycleBucket(result), "eligible_year_2");
  assert.equal(isPromotionCycleReady(result), true);

  const labels = formatPromotionCycleSummary(result, "ผู้กำกับการ");
  assert.equal(labels.readyLabel, "ครบขึ้นผู้กำกับการ");
  assert.equal(labels.eligibleSinceLabel, "2568");
  assert.equal(labels.statusLabel, "ครบขึ้นปีที่ 2");
  assert.equal(labels.completedLabel, "5 วาระ");
});

test("first eligible cycle maps to eligible_this_cycle bucket", () => {
  const result = evaluatePromotionCycle({
    appointmentCycle: 2565,
    currentCycle: 2569,
    policy: { requiredCycles: 4 },
  });
  assert.equal(result.eligibleNow, true);
  assert.equal(result.overdueCycles, 1);
  assert.equal(promotionCycleBucket(result), "eligible_this_cycle");
});
