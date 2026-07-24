import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_PROMOTION_FILTER } from "@/lib/commander_promotion/types";
import { mergeFilter } from "@/lib/commander_promotion/filter_rows";
import {
  normalizeQueryString,
  parsePromotionFilterFromSearchParams,
  promotionFiltersEqual,
  promotionQueryNeedsNavigation,
  serializePromotionFilterToQuery,
} from "@/lib/commander_promotion/url_filter";

describe("commander promotion url_filter", () => {
  it("round-trips bucket / priority / org / search deep-links", () => {
    const filter = mergeFilter(EMPTY_PROMOTION_FILTER, {
      bucket: "alreadyEligible",
      priority: "High",
      regionKey: "r4",
      divisionKey: "d41",
      companyKey: "c414",
      eligibleYear: 2569,
      retirementWindow: "within3",
      search: "ชูชาติ",
      promotionReadyOnly: true,
    });
    const qs = serializePromotionFilterToQuery(filter);
    const parsed = parsePromotionFilterFromSearchParams(new URLSearchParams(qs));
    assert.equal(promotionFiltersEqual(filter, parsed), true);
    assert.match(qs, /bucket=alreadyEligible/);
    assert.match(qs, /priority=High/);
    assert.match(qs, /region=r4/);
    assert.match(qs, /division=d41/);
    assert.match(qs, /company=c414/);
    assert.match(qs, /eligibleYear=2569/);
    assert.match(qs, /retirementWindow=within3/);
    assert.match(qs, /ready=1/);
    assert.match(qs, /search=/);
  });

  it("omits default/empty parameters", () => {
    const qs = serializePromotionFilterToQuery(EMPTY_PROMOTION_FILTER);
    assert.equal(qs, "");
  });

  it("normalizes query key order for equality", () => {
    const a = "search=foo&bucket=nextYear";
    const b = "bucket=nextYear&search=foo";
    assert.equal(normalizeQueryString(a), normalizeQueryString(b));
    assert.equal(promotionQueryNeedsNavigation(a, b), false);
  });

  it("does not require navigation when URL already matches filter", () => {
    const filter = mergeFilter(EMPTY_PROMOTION_FILTER, { bucket: "incomplete" });
    const qs = serializePromotionFilterToQuery(filter);
    assert.equal(promotionQueryNeedsNavigation(qs, qs), false);
    assert.equal(promotionQueryNeedsNavigation(`?${qs}`, qs), false);
  });

  it("requires navigation when a filter is removed", () => {
    const withBucket = serializePromotionFilterToQuery(
      mergeFilter(EMPTY_PROMOTION_FILTER, { bucket: "eligibleThisYear", priority: "Critical" })
    );
    const withoutBucket = serializePromotionFilterToQuery(
      mergeFilter(EMPTY_PROMOTION_FILTER, { priority: "Critical" })
    );
    assert.equal(promotionQueryNeedsNavigation(withBucket, withoutBucket), true);
    const parsed = parsePromotionFilterFromSearchParams(new URLSearchParams(withoutBucket));
    assert.equal(parsed.bucket, null);
    assert.equal(parsed.priority, "Critical");
  });

  it("encodes Thai search text safely", () => {
    const filter = mergeFilter(EMPTY_PROMOTION_FILTER, { search: "ภานุวัฒน์" });
    const qs = serializePromotionFilterToQuery(filter);
    const parsed = parsePromotionFilterFromSearchParams(new URLSearchParams(qs));
    assert.equal(parsed.search, "ภานุวัฒน์");
  });

  it("ignores invalid bucket / priority values", () => {
    const parsed = parsePromotionFilterFromSearchParams(
      new URLSearchParams("bucket=notABucket&priority=Nope&region=ok")
    );
    assert.equal(parsed.bucket, null);
    assert.equal(parsed.priority, null);
    assert.equal(parsed.regionKey, "ok");
  });
});
