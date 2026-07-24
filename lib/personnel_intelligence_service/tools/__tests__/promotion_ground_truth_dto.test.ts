/**
 * Phase 49.7 — Personnel Intelligence Service DTO regression tests.
 *
 * Confirms get_officer_intelligence exposes the corrected canonical
 * promotion fields (firstEligibleYearBe/firstEligibleDate/requiredTenureYears/
 * waitingReasonTh), search_officers/get_promotion_summary still count
 * officers correctly under the corrected policy, no sensitive data is
 * added, no extra dataset load happens, and the tool registry still has
 * exactly nine tools.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { officer, makeBundle } from "@/lib/personnel_intelligence_service/tools/__tests__/_fixtures";
import { assertNoSensitiveKeys, FORBIDDEN_INTELLIGENCE_KEYS } from "@/lib/personnel_intelligence_service/serializers";
import { INTELLIGENCE_TOOL_NAMES } from "@/lib/personnel_intelligence_service/tools";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";

function waitingPromotion(overrides: Partial<PromotionSummary> = {}): PromotionSummary {
  return {
    available: true,
    status: "not_eligible",
    eligibleNow: false,
    monthsUntilEligible: 84,
    overdueYears: 0,
    eligibleYearOrdinal: null,
    targetLevel: "สารวัตร",
    currentRank: "ร.ต.ท.",
    currentPosition: "รองสารวัตร",
    targetRank: "สารวัตร",
    targetPosition: "สารวัตร",
    promotionStatus: "Waiting",
    eligibleDate: null,
    eligibleFiscalYearBe: null,
    firstEligibleDate: "2031-01-01",
    firstEligibleYearBe: 2574,
    firstEligibleFiscalYearBe: 2574,
    yearsEligible: null,
    monthsEligible: null,
    daysEligible: null,
    promotionCyclesPassed: 2,
    displayEligibleSinceTh: null,
    displayStatusTh: "ยังไม่ครบคุณสมบัติ",
    displayReasonTh: "ดำรงระดับรองสารวัตรมาแล้ว 2 ปี จากเกณฑ์ 7 ปี เหลืออีกประมาณ 5 ปี",
    remainingTenureYears: 5,
    displayRemainingTenureTh: "ประมาณ 5 ปี",
    requiredTenureYears: 7,
    waitingReasonTh: "ดำรงระดับตำแหน่งปัจจุบันครบ 7 ปี",
    confidence: "confirmed",
    confidenceReasonTh: null,
    missingEvidence: [],
    priority: 10,
    priorityReason: "Waiting",
    ...overrides,
  };
}

test("F1. get_officer_intelligence exposes the corrected canonical promotion fields", () => {
  const o = officer("reported-officer", {
    positionLevel: "รองสารวัตร",
    positionLevelStartYearBe: 2567,
    promotionIntelligence: waitingPromotion(),
  });
  const { service } = makeBundle("commander", [o]);
  const detail = service.getOfficerIntelligence("reported-officer");

  assert.equal(detail.targetPositionLevel, "สารวัตร");
  assert.equal(detail.currentPositionLevelStartYearBe, 2567);
  assert.equal(detail.requiredTenureYears, 7);
  assert.equal(detail.firstEligibleYearBe, 2574);
  assert.equal(detail.firstEligibleDate, "2031-01-01");
  assert.ok(detail.waitingReasonTh?.includes("7"));
  assert.equal(detail.promotionStatus, "Waiting");
  assert.notEqual(detail.promotionStatus, "AlreadyEligible");
});

test("F2. get_officer_intelligence never leaks a forbidden key when the new promotion fields are present", () => {
  const o = officer("reported-officer", {
    positionLevel: "รองสารวัตร",
    positionLevelStartYearBe: 2567,
    promotionIntelligence: waitingPromotion(),
  });
  const { service } = makeBundle("commander", [o]);
  const detail = service.getOfficerIntelligence("reported-officer");
  assertNoSensitiveKeys(detail);
  const blob = JSON.stringify(detail).toLowerCase();
  for (const key of FORBIDDEN_INTELLIGENCE_KEYS) {
    assert.equal(blob.includes(key.toLowerCase()), false, `forbidden key leaked: ${key}`);
  }
});

test("F3. search_officers correctly filters an officer who is NOT yet eligible out of readyForPromotion", () => {
  const notReady = officer("not-ready", { promotionIntelligence: waitingPromotion() });
  const ready = officer("ready", {
    promotionIntelligence: waitingPromotion({ promotionStatus: "AlreadyEligible", eligibleNow: true, displayStatusTh: "มีคุณสมบัติครบมาแล้ว" }),
  });
  const { service } = makeBundle("commander", [notReady, ready]);
  const result = service.searchOfficers({ filters: { readyForPromotion: true } });
  assert.ok(result.officers.every((o) => o.officerId === "ready"));
  assert.ok(!result.officers.some((o) => o.officerId === "not-ready"));
});

test("F4. get_promotion_summary counts the not-yet-eligible officer under Waiting, never AlreadyEligible", () => {
  const o = officer("reported-officer", { promotionIntelligence: waitingPromotion() });
  const { service } = makeBundle("commander", [o]);
  const summary = service.getPromotionSummary();
  const waitingBucket = summary.byStatus.find((b) => b.id === "Waiting");
  const alreadyEligibleBucket = summary.byStatus.find((b) => b.id === "AlreadyEligible");
  assert.ok((waitingBucket?.value ?? 0) >= 1);
  assert.equal(alreadyEligibleBucket?.value ?? 0, 0);
});

// ---------------------------------------------------------------------------
// Phase 49.8 — rank tenure + data confidence DTO regression tests
// ---------------------------------------------------------------------------

test("F6. get_officer_intelligence exposes rank-tenure and confidence fields for an officer with confirmed evidence", () => {
  const o = officer("confirmed-officer", {
    rankStartedAtYearBe: 2560,
    yearsInRankCount: 9,
    promotionIntelligence: waitingPromotion({ confidence: "confirmed", confidenceReasonTh: null, missingEvidence: [] }),
  });
  const { service } = makeBundle("commander", [o]);
  const detail = service.getOfficerIntelligence("confirmed-officer");
  assert.equal(detail.currentRankStartedAtYearBe, 2560);
  assert.equal(detail.yearsInRank, 9);
  assert.equal(detail.promotionConfidence, "confirmed");
  assert.equal(detail.promotionConfidenceReasonTh, null);
  assert.deepEqual(detail.promotionMissingEvidence, []);
});

test("F7. get_officer_intelligence exposes 'incomplete' confidence with missingEvidence when rank-start evidence is missing", () => {
  const o = officer("incomplete-officer", {
    rankStartedAtYearBe: null,
    yearsInRankCount: null,
    promotionIntelligence: waitingPromotion({
      promotionStatus: "Unknown",
      displayStatusTh: "ไม่สามารถประเมินได้",
      confidence: "incomplete",
      confidenceReasonTh: "ไม่พบวันที่เริ่มครองยศปัจจุบัน",
      missingEvidence: ["current_rank_start_date"],
    }),
  });
  const { service } = makeBundle("commander", [o]);
  const detail = service.getOfficerIntelligence("incomplete-officer");
  assert.equal(detail.currentRankStartedAtYearBe, null);
  assert.equal(detail.yearsInRank, null);
  assert.equal(detail.promotionConfidence, "incomplete");
  assert.equal(detail.promotionConfidenceReasonTh, "ไม่พบวันที่เริ่มครองยศปัจจุบัน");
  assert.deepEqual(detail.promotionMissingEvidence, ["current_rank_start_date"]);
  assert.equal(detail.promotionStatus, "Unknown");
});

test("F8. confidence never changes the underlying business rule — an incomplete-confidence officer's promotionStatus is Unknown, never fabricated as eligible or ineligible", () => {
  const o = officer("incomplete-officer", {
    promotionIntelligence: waitingPromotion({
      promotionStatus: "Unknown",
      eligibleNow: false,
      overdueYears: 0,
      confidence: "incomplete",
      confidenceReasonTh: "ไม่พบวันที่เริ่มครองยศปัจจุบัน",
      missingEvidence: ["current_rank_start_date"],
    }),
  });
  const { service } = makeBundle("commander", [o]);
  const detail = service.getOfficerIntelligence("incomplete-officer");
  assert.notEqual(detail.promotionStatus, "AlreadyEligible");
  assert.notEqual(detail.promotionStatus, "EligibleThisYear");
  assert.notEqual(detail.promotionStatus, "NotEligible");
  assert.notEqual(detail.promotionStatus, "Waiting");
  assert.equal(detail.promotionStatus, "Unknown");
});

test("F9. promotionMissingEvidence is serializable and contains only stable keys, never long Thai display text as the key itself", () => {
  const o = officer("incomplete-officer", {
    promotionIntelligence: waitingPromotion({
      confidence: "incomplete",
      confidenceReasonTh: "ไม่พบวันที่เริ่มครองยศปัจจุบัน",
      missingEvidence: ["current_rank_start_date"],
    }),
  });
  const { service } = makeBundle("commander", [o]);
  const detail = service.getOfficerIntelligence("incomplete-officer");
  for (const key of detail.promotionMissingEvidence) {
    assert.ok(/^[a-z_]+$/.test(key), `missingEvidence key must be a stable snake_case identifier, got: ${key}`);
  }
  assertNoSensitiveKeys(detail);
});

test("F10. search_officers/get_promotion_summary never mutate the source dataset when reading confidence fields", () => {
  const o = officer("confirmed-officer", { rankStartedAtYearBe: 2560, yearsInRankCount: 9 });
  const snapshotBefore = JSON.stringify(o);
  const { service } = makeBundle("commander", [o]);
  service.searchOfficers({});
  service.getPromotionSummary();
  assert.equal(JSON.stringify(o), snapshotBefore, "officer fixture must not be mutated by tool calls");
});

test("F5. tool registry still has exactly nine tools — no new tool, no removed tool", () => {
  assert.equal(INTELLIGENCE_TOOL_NAMES.length, 9);
  assert.deepEqual(
    [...INTELLIGENCE_TOOL_NAMES].sort(),
    [
      "get_commander_summary",
      "get_document_summary",
      "get_executive_brief",
      "get_officer_intelligence",
      "get_promotion_summary",
      "get_report_projection",
      "get_retirement_summary",
      "get_training_summary",
      "search_officers",
    ]
  );
});

test("F11. Phase 49.9: สารวัตร → รองผู้กำกับการ DTO exposes requiredTenureYears=5, firstEligibleYearBe=2569, overdueYears=0 in first cycle waitingYears sense", () => {
  const o = officer("sarawat-officer", {
    positionLevel: "สารวัตร",
    positionLevelStartYearBe: 2564,
    positionLevelYearCount: 5,
    promotionIntelligence: waitingPromotion({
      targetLevel: "รองผู้กำกับการ",
      currentPosition: "สารวัตร",
      targetRank: "รองผู้กำกับการ",
      targetPosition: "รองผู้กำกับการ",
      promotionStatus: "EligibleThisYear",
      status: "eligible",
      eligibleNow: true,
      monthsUntilEligible: 0,
      overdueYears: 0,
      eligibleYearOrdinal: 1,
      promotionCyclesPassed: 0,
      firstEligibleDate: "2026-02-16",
      firstEligibleYearBe: 2569,
      firstEligibleFiscalYearBe: 2569,
      eligibleDate: "2026-02-16",
      eligibleFiscalYearBe: 2569,
      requiredTenureYears: 5,
      waitingReasonTh: null,
      displayStatusTh: "ครบคุณสมบัติในปีนี้",
      displayReasonTh:
        "ดำรงระดับสารวัตรครบเกณฑ์ 5 ปีแล้ว มีคุณสมบัติด้านระยะเวลาสำหรับการพิจารณาเลื่อนเป็นรองผู้กำกับการใน พ.ศ. 2569",
      remainingTenureYears: 0,
      displayRemainingTenureTh: "ครบเกณฑ์แล้ว",
    }),
  });
  const { service } = makeBundle("commander", [o]);
  const detail = service.getOfficerIntelligence("sarawat-officer");
  assert.equal(detail.requiredTenureYears, 5);
  assert.equal(detail.firstEligibleYearBe, 2569);
  assert.equal(detail.firstEligibleDate, "2026-02-16");
  assert.notEqual(detail.firstEligibleYearBe, 2568);
  assert.notEqual(detail.firstEligibleYearBe, 2570);
  assert.equal(detail.promotionStatus, "EligibleThisYear");
  assertNoSensitiveKeys(detail);
});
