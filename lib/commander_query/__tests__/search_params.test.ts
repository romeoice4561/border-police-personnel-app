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
