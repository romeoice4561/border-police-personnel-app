/**
 * Commander Search URL filter parsing tests (Phase 45 completion pass,
 * Task 14 items 16-17).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { filtersFromSearchParams } from "@/lib/commander_query/search_params";

test("16. training status query-string parsing: a recognized value is applied to the filter", () => {
  const filters = filtersFromSearchParams({ trainingStatus: "MissingRequired" });
  assert.equal(filters.trainingStatus, "MissingRequired");
});

test("17. NoPolicy is a valid, parseable filter value (never rejected as unrecognized)", () => {
  const filters = filtersFromSearchParams({ trainingStatus: "NoPolicy" });
  assert.equal(filters.trainingStatus, "NoPolicy");
});

test("every real TrainingStatus value parses correctly", () => {
  const statuses = ["Complete", "MissingRequired", "ExpiringSoon", "Expired", "Unverified", "NoPolicy", "NoData", "Unknown"];
  for (const status of statuses) {
    const filters = filtersFromSearchParams({ trainingStatus: status });
    assert.equal(filters.trainingStatus, status);
  }
});

test("an unrecognized trainingStatus value is silently ignored, never crashes, never a fabricated filter", () => {
  const filters = filtersFromSearchParams({ trainingStatus: "SomeFabricatedStatus" });
  assert.equal(filters.trainingStatus, undefined);
});

test("a non-string trainingStatus (e.g. an array, from a duplicated query param) is ignored", () => {
  const filters = filtersFromSearchParams({ trainingStatus: ["MissingRequired", "Expired"] });
  assert.equal(filters.trainingStatus, undefined);
});

test("missing trainingStatus param leaves the filter unset, not defaulted to any value", () => {
  const filters = filtersFromSearchParams({});
  assert.equal(filters.trainingStatus, undefined);
});

test("trainingStatus parses independently of promotionEligibilityStatus/retirement — all three can be present in the same URL", () => {
  const filters = filtersFromSearchParams({
    promotionEligibilityStatus: "AlreadyEligible",
    retirement: "within-1-year",
    trainingStatus: "Expired",
  });
  assert.equal(filters.promotionEligibilityStatus, "AlreadyEligible");
  assert.equal(filters.retirementWithin, "within-1-year");
  assert.equal(filters.trainingStatus, "Expired");
});

// ── Phase 49A: document-intelligence filters ────────────────────────────────

test("documentReadiness parses and combines with pre-existing filters in the same URL", () => {
  const filters = filtersFromSearchParams({ documentReadiness: "BLOCKED", trainingStatus: "Expired" });
  assert.equal(filters.documentReadiness, "BLOCKED");
  assert.equal(filters.trainingStatus, "Expired");
});

test("boolean document filters (pendingOcrReview etc.) parse from the '1' sentinel", () => {
  const filters = filtersFromSearchParams({ pendingOcrReview: "1", missingRequiredDocument: "1" });
  assert.equal(filters.pendingOcrReview, true);
  assert.equal(filters.missingRequiredDocument, true);
});

test("an unrecognized documentReadiness value is silently ignored", () => {
  const filters = filtersFromSearchParams({ documentReadiness: "BOGUS" });
  assert.equal(filters.documentReadiness, undefined);
});

// ── Phase 49B: Intelligence Center drill-down URL seeds ─────────────────────

test("readyForPromotion parses from true/1 and seeds the existing boolean filter", () => {
  assert.equal(filtersFromSearchParams({ readyForPromotion: "true" }).readyForPromotion, true);
  assert.equal(filtersFromSearchParams({ readyForPromotion: "1" }).readyForPromotion, true);
  assert.equal(filtersFromSearchParams({ readyForPromotion: "false" }).readyForPromotion, undefined);
});

test("flagCode and priority parse only allowlisted Intelligence values", () => {
  assert.equal(filtersFromSearchParams({ flagCode: "PROFILE_INCOMPLETE" }).flagCode, "PROFILE_INCOMPLETE");
  assert.equal(filtersFromSearchParams({ priority: "critical" }).priority, "critical");
  assert.equal(filtersFromSearchParams({ flagCode: "NOT_A_FLAG" }).flagCode, undefined);
  assert.equal(filtersFromSearchParams({ priority: "urgent" }).priority, undefined);
});

test("Phase 49B KPI drill-down params combine with document/promotion filters", () => {
  const filters = filtersFromSearchParams({
    readyForPromotion: "true",
    flagCode: "PROFILE_INCOMPLETE",
    priority: "high",
    promotionEligibilityStatus: "AlreadyEligible",
    missingRequiredDocument: "1",
  });
  assert.equal(filters.readyForPromotion, true);
  assert.equal(filters.flagCode, "PROFILE_INCOMPLETE");
  assert.equal(filters.priority, "high");
  assert.equal(filters.promotionEligibilityStatus, "AlreadyEligible");
  assert.equal(filters.missingRequiredDocument, true);
});

// ── Phase 49.7: canonical current/target position-level + exact-year URL drill-downs ──

test("currentPositionLevel query param maps onto the existing positionLevel filter field (canonical current-level dropdown's own field, no separate predicate)", () => {
  const filters = filtersFromSearchParams({ currentPositionLevel: "รองสารวัตร" });
  assert.equal(filters.positionLevel, "รองสารวัตร");
});

test("targetPositionLevel query param maps onto the existing toPositionLevel filter field", () => {
  const filters = filtersFromSearchParams({ targetPositionLevel: "สารวัตร" });
  assert.equal(filters.toPositionLevel, "สารวัตร");
});

test("every real (non-Unknown) POSITION_LEVELS value parses for both currentPositionLevel and targetPositionLevel", () => {
  const levels = ["รองสารวัตร", "สารวัตร", "รองผู้กำกับการ", "ผู้กำกับการ", "รองผู้บังคับการ", "ผู้บังคับการ", "รองผู้บัญชาการ"];
  for (const level of levels) {
    assert.equal(filtersFromSearchParams({ currentPositionLevel: level }).positionLevel, level);
    assert.equal(filtersFromSearchParams({ targetPositionLevel: level }).toPositionLevel, level);
  }
});

test("an unrecognized currentPositionLevel/targetPositionLevel value (typo, garbage, 'Unknown') is silently ignored — never a fabricated filter", () => {
  assert.equal(filtersFromSearchParams({ currentPositionLevel: "not-a-real-level" }).positionLevel, undefined);
  assert.equal(filtersFromSearchParams({ currentPositionLevel: "Unknown" }).positionLevel, undefined);
  assert.equal(filtersFromSearchParams({ targetPositionLevel: "not-a-real-level" }).toPositionLevel, undefined);
});

test("REGRESSION: this test fails against the old (pre-fix) behavior — a current-level drill-down URL param must actually narrow Commander Search, not be silently unrecognized", () => {
  // The previously-attempted 'fromPositionLevel' URL parameter was NEVER
  // read by filtersFromSearchParams — passing it produced a filters object
  // completely unaffected by position level, matching the reported symptom
  // "the attempted current-position-level filter did not reduce the
  // Commander Search result set." The canonical replacement name
  // (currentPositionLevel) must actually populate the filter.
  const oldUnsupportedParam = filtersFromSearchParams({ fromPositionLevel: "รองสารวัตร" });
  assert.equal(oldUnsupportedParam.positionLevel, undefined, "the old unsupported param name must not silently work by accident");
  assert.equal(oldUnsupportedParam.fromPositionLevel, undefined, "filtersFromSearchParams must not pass through arbitrary raw query keys");

  const newSupportedParam = filtersFromSearchParams({ currentPositionLevel: "รองสารวัตร" });
  assert.equal(newSupportedParam.positionLevel, "รองสารวัตร", "the canonical param name must actually populate the filter");
});

test("positionLevelStartYearBe query param parses a positive integer Buddhist-Era year", () => {
  assert.equal(filtersFromSearchParams({ positionLevelStartYearBe: "2567" }).positionLevelStartYearBe, 2567);
});

test("firstEligibleYearBe query param parses a positive integer Buddhist-Era year", () => {
  assert.equal(filtersFromSearchParams({ firstEligibleYearBe: "2574" }).firstEligibleYearBe, 2574);
});

test("non-numeric or malformed year values are ignored, never coerced to NaN/0", () => {
  assert.equal(filtersFromSearchParams({ positionLevelStartYearBe: "not-a-year" }).positionLevelStartYearBe, undefined);
  assert.equal(filtersFromSearchParams({ firstEligibleYearBe: "25.74" }).firstEligibleYearBe, undefined);
  assert.equal(filtersFromSearchParams({ firstEligibleYearBe: "" }).firstEligibleYearBe, undefined);
});

test("all Phase 49.7 promotion drill-down params combine correctly in one URL, reproducing the reported officer's scenario as a shareable link", () => {
  const filters = filtersFromSearchParams({
    currentPositionLevel: "รองสารวัตร",
    targetPositionLevel: "สารวัตร",
    firstEligibleYearBe: "2574",
    promotionEligibilityStatus: "Waiting",
  });
  assert.equal(filters.positionLevel, "รองสารวัตร");
  assert.equal(filters.toPositionLevel, "สารวัตร");
  assert.equal(filters.firstEligibleYearBe, 2574);
  assert.equal(filters.promotionEligibilityStatus, "Waiting");
});

test("unrelated/unknown query parameters never alter filter state (no accidental field pollution)", () => {
  const filters = filtersFromSearchParams({ currentPositionLevel: "รองสารวัตร", someRandomParam: "xyz", another: "123" });
  assert.equal(Object.keys(filters).length, 1, "only the recognized field should be set");
  assert.equal(filters.positionLevel, "รองสารวัตร");
});
