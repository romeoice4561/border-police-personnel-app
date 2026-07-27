/**
 * Phase 52.2.1 — executive label polish (presentation helpers).
 * Included by the lib test glob in package.json.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCompanyLabelTh,
  presentFilterOptions,
  promotionLabelTh,
  sanitizeExecutiveCopy,
  UI_PROMOTION_LABEL_TH,
} from "@/components/commander-workforce/labels";
import { buildExecutiveSummaryBullets } from "@/components/commander-workforce/executive-summary";
import { composeCommanderWorkforceViewModel } from "@/lib/commander_workforce/compose";

describe("executive Thai labels (52.2.1)", () => {
  it("maps promotion enums to Thai executive labels", () => {
    assert.equal(promotionLabelTh("EligibleThisYear"), "พร้อมเลื่อนปีนี้");
    assert.equal(promotionLabelTh("AlreadyEligible"), "ครบคุณสมบัติก่อนปีนี้");
    assert.equal(promotionLabelTh("Waiting"), "อยู่ระหว่างรอ");
    assert.equal(promotionLabelTh("Unknown"), "ไม่ทราบข้อมูล");
    assert.equal(UI_PROMOTION_LABEL_TH.MissingTraining, "ขาดหลักสูตร");
  });

  it("formats company labels with ร้อย prefix", () => {
    assert.equal(formatCompanyLabelTh("ตชด.414"), "ร้อย ตชด.414");
    assert.equal(formatCompanyLabelTh("414"), "ร้อย ตชด.414");
    assert.equal(formatCompanyLabelTh("ร้อย ตชด.415"), "ร้อย ตชด.415");
  });

  it("presents filter options in Thai while preserving filter values", () => {
    const opts = presentFilterOptions("promotion", [
      { value: "EligibleThisYear", labelTh: "EligibleThisYear", count: 2 },
    ]);
    assert.equal(opts[0].value, "EligibleThisYear");
    assert.equal(opts[0].labelTh, "พร้อมเลื่อนปีนี้");
  });

  it("sanitizes English enums out of executive copy", () => {
    const cleaned = sanitizeExecutiveCopy("สถานะ PromotionSummary.EligibleThisYear / AlreadyEligible");
    assert.ok(!cleaned.includes("EligibleThisYear"));
    assert.ok(!cleaned.includes("AlreadyEligible"));
    assert.ok(!cleaned.includes("PromotionSummary"));
    assert.ok(cleaned.includes("พร้อมเลื่อนปีนี้"));
    assert.ok(cleaned.includes("ครบคุณสมบัติก่อนปีนี้"));
  });

  it("builds operational summary bullets without AI wording", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers: [],
      asOfDate: new Date("2026-07-17T00:00:00.000Z"),
      now: new Date("2026-07-17T00:00:00.000Z"),
    });
    const bullets = buildExecutiveSummaryBullets(vm);
    assert.ok(bullets.length >= 4);
    assert.ok(bullets.every((b) => !/AI|chatgpt/i.test(b)));
  });
});
