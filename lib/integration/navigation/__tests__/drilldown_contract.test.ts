import { test } from "node:test";
import assert from "node:assert/strict";

import {
  serializeCommanderDocumentFilters,
  parseCommanderDocumentFilters,
  buildCommanderDocumentFilterUrl,
  buildOfficerProfileUrl,
  buildOfficerEpfUrl,
  buildDocumentReviewUrl,
} from "@/lib/integration/navigation/drilldown_contract";
import type { DocumentIntelligenceFilters } from "@/lib/integration/navigation/document_filter_types";

test("serialize omits every default/empty field — empty filters produce an empty object", () => {
  assert.deepEqual(serializeCommanderDocumentFilters({}), {});
});

test("serialize + parse round trip for every enum field", () => {
  const filters: DocumentIntelligenceFilters = { documentReadiness: "BLOCKED", documentCompleteness: "critical", expiryStatus: "expired" };
  const serialized = serializeCommanderDocumentFilters(filters);
  const parsed = parseCommanderDocumentFilters(serialized);
  assert.deepEqual(parsed, filters);
});

test("serialize + parse round trip for every boolean field", () => {
  const filters: DocumentIntelligenceFilters = { pendingOcrReview: true, unsupportedDocument: true, missingRequiredDocument: true, qualityWarning: true };
  const serialized = serializeCommanderDocumentFilters(filters);
  const parsed = parseCommanderDocumentFilters(serialized);
  assert.deepEqual(parsed, filters);
});

test("false boolean filters are never serialized (omitted, not '=false')", () => {
  const serialized = serializeCommanderDocumentFilters({ pendingOcrReview: false });
  assert.deepEqual(serialized, {});
});

test("parse silently ignores unrecognized/malformed values rather than crashing", () => {
  const parsed = parseCommanderDocumentFilters({ documentReadiness: "NOT_A_REAL_STATUS", expiryStatus: "also_bogus" });
  assert.deepEqual(parsed, {});
});

test("parse ignores non-document keys without error (delegated to the caller's own parser)", () => {
  const parsed = parseCommanderDocumentFilters({ promotionEligibilityStatus: "AlreadyEligible", documentReadiness: "READY" });
  assert.deepEqual(parsed, { documentReadiness: "READY" });
});

test("buildCommanderDocumentFilterUrl produces a minimal URL with no query string for empty filters", () => {
  assert.equal(buildCommanderDocumentFilterUrl({}), "/commander-search");
});

test("buildCommanderDocumentFilterUrl encodes filters into the query string", () => {
  const url = buildCommanderDocumentFilterUrl({ documentReadiness: "INCOMPLETE" });
  assert.equal(url, "/commander-search?documentReadiness=INCOMPLETE");
});

test("buildCommanderDocumentFilterUrl preserves extraParams (unrelated existing filters) alongside document filters", () => {
  const url = buildCommanderDocumentFilterUrl({ documentReadiness: "READY" }, { rank: "ร.ต.อ." });
  const parsed = new URL(url, "http://test");
  assert.equal(parsed.searchParams.get("rank"), "ร.ต.อ.");
  assert.equal(parsed.searchParams.get("documentReadiness"), "READY");
});

test("a URL built by buildCommanderDocumentFilterUrl, when reparsed, reproduces the exact same filters (reload reproducibility)", () => {
  const original: DocumentIntelligenceFilters = { documentReadiness: "NEEDS_REVIEW", pendingOcrReview: true };
  const url = buildCommanderDocumentFilterUrl(original);
  const parsedUrl = new URL(url, "http://test");
  const params: Record<string, string> = {};
  parsedUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const reparsed = parseCommanderDocumentFilters(params);
  assert.deepEqual(reparsed, original);
});

test("buildOfficerProfileUrl encodes the officer code safely (handles slashes in codes like 'ภาค4/20')", () => {
  const url = buildOfficerProfileUrl("ภาค4/20");
  assert.ok(!url.includes("ภาค4/20"), "the raw slash-containing code must be percent-encoded, not embedded raw as a path segment");
  assert.equal(decodeURIComponent(url.replace("/officers/", "")), "ภาค4/20");
});

test("buildOfficerEpfUrl appends a section=epf hint on top of the profile URL", () => {
  const url = buildOfficerEpfUrl("test-officer");
  assert.ok(url.startsWith(buildOfficerProfileUrl("test-officer")));
  assert.ok(url.endsWith("?section=epf"));
});

test("buildDocumentReviewUrl currently resolves to the same place as buildOfficerEpfUrl (no standalone per-document review route exists)", () => {
  assert.equal(buildDocumentReviewUrl("test-officer"), buildOfficerEpfUrl("test-officer"));
});
