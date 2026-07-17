import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCommanderInsightTh } from "@/lib/commander_query/commander_insight";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionEligibilityStatus, PromotionSummary } from "@/lib/intelligence/shared/types";

function fakeOfficer(status: PromotionEligibilityStatus): CommanderQueryOfficer {
  const promotion = { promotionStatus: status } as PromotionSummary;
  return { officerId: `o-${status}-${Math.random()}`, promotionIntelligence: promotion } as CommanderQueryOfficer;
}

test("empty dataset returns the fixed no-results sentence, never fabricated", () => {
  assert.equal(buildCommanderInsightTh([]), "ไม่พบกำลังพลตรงกับเงื่อนไขที่กำหนด");
});

test("total-only when every officer is NotEligible/Unknown (no notable statuses)", () => {
  const officers = [fakeOfficer("NotEligible"), fakeOfficer("Unknown")];
  const sentence = buildCommanderInsightTh(officers);
  assert.match(sentence, /พบกำลังพล 2 นาย/);
  assert.match(sentence, /ยังไม่มีรายที่ครบคุณสมบัติ/);
});

test("mentions EligibleThisYear and AlreadyEligible counts when present", () => {
  const officers = [fakeOfficer("EligibleThisYear"), fakeOfficer("EligibleThisYear"), fakeOfficer("AlreadyEligible")];
  const sentence = buildCommanderInsightTh(officers);
  assert.match(sentence, /พบกำลังพล 3 นาย/);
  assert.match(sentence, /ครบคุณสมบัติปีนี้ 2 นาย/);
  assert.match(sentence, /มีคุณสมบัติครบแล้วรอการแต่งตั้ง 1 นาย/);
});

test("deterministic: identical input produces identical output", () => {
  const officers = [fakeOfficer("MissingTraining"), fakeOfficer("MissingDocuments"), fakeOfficer("RetirementRestricted")];
  const first = buildCommanderInsightTh(officers);
  const second = buildCommanderInsightTh(officers);
  assert.equal(first, second);
  assert.match(first, /ขาดหลักสูตร 1 นาย/);
  assert.match(first, /ขาดเอกสาร 1 นาย/);
  assert.match(first, /ใกล้เกษียณอายุราชการ 1 นาย/);
});
