/**
 * Phase 52.2 — Workforce URL filter presentation adapter tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countActiveWorkforceFilters,
  emptyWorkforceFilters,
  normalizeWorkforceQueryString,
  parseWorkforceFiltersFromSearchParams,
  searchParamsRecordToURLSearchParams,
  serializeWorkforceFiltersToQuery,
} from "@/lib/commander_workforce/url_filters";

describe("workforce url filters", () => {
  it("round-trips public-code filters without inventing values", () => {
    const original = {
      ...emptyWorkforceFilters(),
      regionPublicCode: "4",
      divisionPublicCode: "41",
      companyPublicCode: "414",
      rank: "ร.ต.อ.",
      promotionStatus: "EligibleThisYear",
      retirementWindow: "within_1_year",
      search: "ทดสอบ",
    };
    const qs = serializeWorkforceFiltersToQuery(original);
    const parsed = parseWorkforceFiltersFromSearchParams(new URLSearchParams(qs));
    assert.equal(parsed.regionPublicCode, "4");
    assert.equal(parsed.divisionPublicCode, "41");
    assert.equal(parsed.companyPublicCode, "414");
    assert.equal(parsed.rank, "ร.ต.อ.");
    assert.equal(parsed.promotionStatus, "EligibleThisYear");
    assert.equal(parsed.retirementWindow, "within_1_year");
    assert.equal(parsed.search, "ทดสอบ");
    assert.equal(serializeWorkforceFiltersToQuery(parsed), normalizeWorkforceQueryString(qs));
  });

  it("drops invalid promotion status via normalizeWorkforceFilters", () => {
    const parsed = parseWorkforceFiltersFromSearchParams(
      new URLSearchParams("promotionStatus=NotARealStatus&rank=พ.ต.ท.")
    );
    assert.equal(parsed.promotionStatus, null);
    assert.equal(parsed.rank, "พ.ต.ท.");
  });

  it("counts active filters and clears to empty", () => {
    const filters = parseWorkforceFiltersFromSearchParams(
      searchParamsRecordToURLSearchParams({
        regionPublicCode: "4",
        search: "x",
      })
    );
    assert.equal(countActiveWorkforceFilters(filters), 2);
    assert.equal(countActiveWorkforceFilters(emptyWorkforceFilters()), 0);
  });

  it("never serializes internal organization id keys", () => {
    const qs = serializeWorkforceFiltersToQuery({
      ...emptyWorkforceFilters(),
      regionPublicCode: "4",
    });
    assert.ok(!qs.includes("regionId"));
    assert.ok(!qs.includes("battalionId"));
    assert.ok(!qs.includes("companyId"));
    assert.ok(qs.includes("regionPublicCode=4"));
  });
});
