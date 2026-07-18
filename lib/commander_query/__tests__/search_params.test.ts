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
