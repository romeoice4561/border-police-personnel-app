/**
 * Phase 52.2.2 — qualifiedNow presentation aggregate (not a Promotion Engine status).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EMPTY_PROMOTION_FILTER,
  type PreparedPromotionRow,
} from "@/lib/commander_promotion/types";
import { filterPreparedRows } from "@/lib/commander_promotion/filter_rows";
import {
  parsePromotionFilterFromSearchParams,
  serializePromotionFilterToQuery,
} from "@/lib/commander_promotion/url_filter";
import {
  CPI_STATUS_LABEL_TH,
  EXECUTIVE_BUCKET_LABEL_TH,
  QUALIFIED_NOW_LABEL_TH,
} from "@/lib/commander_promotion/presentation_labels";
import { PROMOTION_STATUS_DISPLAY_TH } from "@/lib/intelligence/promotion";

function row(
  officerId: string,
  bucket: "eligibleThisYear" | "alreadyEligible" | "nextYear",
  status: "EligibleThisYear" | "AlreadyEligible" | "Waiting"
): PreparedPromotionRow {
  return {
    officerId,
    profileHref: `/officers/${officerId}`,
    portraitUrl: null,
    rankLabel: "ร.ต.อ.",
    fullName: officerId,
    searchText: officerId.toLowerCase(),
    regionKey: "4",
    regionLabel: "ภาค 4",
    divisionKey: "41",
    divisionLabel: "กก.41",
    companyKey: "414",
    companyLabel: "ร้อย ตชด.414",
    currentPositionLabel: "รอง สว.",
    currentPositionLevel: "รองสารวัตร",
    targetPositionLabel: "สารวัตร",
    targetPositionLevel: "สารวัตร",
    positionLevelStartYearBe: 2560,
    completedTenureYears: 5,
    requiredTenureYears: 5,
    remainingTenureYears: 0,
    remainingTenureLabel: "ครบแล้ว",
    readinessPercent: 100,
    readinessBand: "complete",
    promotionStatus: status,
    executiveBucket: bucket,
    firstEligibleYearBe: status === "EligibleThisYear" ? 2569 : 2568,
    appointmentYearBe: 2569,
    cycleLabel: null,
    ordinalLabel: null,
    overdueYears: status === "AlreadyEligible" ? 1 : 0,
    recommendedActionTh: "—",
    statusLabelTh: CPI_STATUS_LABEL_TH[status],
    priorityBand: "Medium",
    priorityOrder: 2,
    retirementYearBe: 2580,
    retirementRemainingYears: 11,
    retirementWindow: "beyond",
    hasUnknownRetirement: false,
    blockerKeys: [],
    missingEvidence: [],
    hasMissingDocuments: false,
    hasMissingTraining: false,
    hasUnknownPositionHistory: false,
    isPromotionReady: bucket === "eligibleThisYear" || bucket === "alreadyEligible",
    isBlocked: false,
  };
}

describe("qualifiedNow presentation aggregate", () => {
  const rows: PreparedPromotionRow[] = [
    ...Array.from({ length: 5 }, (_, i) => row(`EY${i}`, "eligibleThisYear", "EligibleThisYear")),
    ...Array.from({ length: 15 }, (_, i) => row(`AE${i}`, "alreadyEligible", "AlreadyEligible")),
    row("NY0", "nextYear", "Waiting"),
  ];

  it("keeps EligibleThisYear and AlreadyEligible mutually exclusive on rows", () => {
    const ids = new Set(rows.map((r) => r.officerId));
    assert.equal(ids.size, rows.length);
    for (const r of rows) {
      if (r.promotionStatus === "EligibleThisYear") assert.equal(r.executiveBucket, "eligibleThisYear");
      if (r.promotionStatus === "AlreadyEligible") assert.equal(r.executiveBucket, "alreadyEligible");
      assert.notEqual(r.executiveBucket as string, "qualifiedNow");
    }
  });

  it("does not change Promotion Engine display dictionary (PromotionSummary source)", () => {
    // Engine labels may differ from CPI presentation overlays — must remain untouched.
    assert.ok(PROMOTION_STATUS_DISPLAY_TH.EligibleThisYear.length > 0);
    assert.ok(PROMOTION_STATUS_DISPLAY_TH.AlreadyEligible.length > 0);
    const engineSrc = readFileSync(
      path.join(process.cwd(), "lib/intelligence/promotion/index.ts"),
      "utf8"
    );
    assert.ok(engineSrc.includes('EligibleThisYear: "ครบคุณสมบัติในปีนี้"'));
    assert.ok(engineSrc.includes('AlreadyEligible: "มีคุณสมบัติครบมาแล้ว"'));
  });

  it("qualifiedNow count equals sum of both canonical buckets (5+15=20)", () => {
    const filtered = filterPreparedRows(rows, {
      ...EMPTY_PROMOTION_FILTER,
      bucket: "qualifiedNow",
    });
    assert.equal(filtered.length, 20);
    assert.equal(
      filtered.filter((r) => r.executiveBucket === "eligibleThisYear").length,
      5
    );
    assert.equal(
      filtered.filter((r) => r.executiveBucket === "alreadyEligible").length,
      15
    );
  });

  it("qualifiedNow list includes both statuses, no duplicates, retains canonical status", () => {
    const filtered = filterPreparedRows(rows, {
      ...EMPTY_PROMOTION_FILTER,
      bucket: "qualifiedNow",
    });
    const ids = filtered.map((r) => r.officerId);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(filtered.some((r) => r.promotionStatus === "EligibleThisYear"));
    assert.ok(filtered.some((r) => r.promotionStatus === "AlreadyEligible"));
    assert.ok(filtered.every((r) => r.promotionStatus === "EligibleThisYear" || r.promotionStatus === "AlreadyEligible"));
    for (const r of filtered) {
      if (r.promotionStatus === "EligibleThisYear") {
        assert.equal(r.statusLabelTh, "พร้อมเลื่อนปีนี้");
      } else {
        assert.equal(r.statusLabelTh, "ครบคุณสมบัติก่อนปีนี้");
      }
    }
  });

  it("preserves eligibleThisYear and alreadyEligible bucket filters", () => {
    assert.equal(
      filterPreparedRows(rows, { ...EMPTY_PROMOTION_FILTER, bucket: "eligibleThisYear" }).length,
      5
    );
    assert.equal(
      filterPreparedRows(rows, { ...EMPTY_PROMOTION_FILTER, bucket: "alreadyEligible" }).length,
      15
    );
  });

  it("round-trips bucket=qualifiedNow through URL state", () => {
    const qs = serializePromotionFilterToQuery({
      ...EMPTY_PROMOTION_FILTER,
      bucket: "qualifiedNow",
    });
    assert.match(qs, /bucket=qualifiedNow/);
    const parsed = parsePromotionFilterFromSearchParams(new URLSearchParams(qs));
    assert.equal(parsed.bucket, "qualifiedNow");
    assert.equal(serializePromotionFilterToQuery(parsed), qs);
  });

  it("Thai labels distinguish current-year vs prior-year eligibility", () => {
    assert.equal(EXECUTIVE_BUCKET_LABEL_TH.eligibleThisYear, "พร้อมเลื่อนปีนี้");
    assert.equal(EXECUTIVE_BUCKET_LABEL_TH.alreadyEligible, "ครบคุณสมบัติก่อนปีนี้");
    assert.equal(QUALIFIED_NOW_LABEL_TH, "ผู้มีคุณสมบัติครบทั้งหมด");
    assert.notEqual(EXECUTIVE_BUCKET_LABEL_TH.alreadyEligible, "ครบคุณสมบัติมาแล้ว");
    assert.notEqual(EXECUTIVE_BUCKET_LABEL_TH.alreadyEligible, "ครบแล้ว");
  });

  it("presentation layer does not import promotion engine calculator", () => {
    const src = readFileSync(
      path.join(process.cwd(), "lib/commander_promotion/presentation_labels.ts"),
      "utf8"
    );
    assert.ok(!src.includes("computePromotionSummary"));
    assert.ok(!src.includes("from \"@/lib/intelligence/promotion\""));
  });

  it("CPI ViewModel copy avoids ambiguous AlreadyEligible wording", () => {
    const src = readFileSync(
      path.join(process.cwd(), "lib/commander_promotion/build_view_model.ts"),
      "utf8"
    );
    assert.ok(src.includes("ครบคุณสมบัติก่อนปีนี้"));
    assert.ok(!src.includes("ครบคุณสมบัติมาแล้วและควรได้รับการทบทวน"));
    assert.ok(!src.includes("ทบทวนผู้ที่ครบคุณสมบัติมาแล้ว"));
    assert.ok(src.includes('bucket: "qualifiedNow"'));
  });
});
