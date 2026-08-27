/**
 * DI-8.1.1 Defect B — return-context navigation helper tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeInternalReturnPath, getSafeReturnTo, withReturnTo } from "@/lib/ui/return_context";

test("valid internal /drug-intelligence/map path is accepted", () => {
  assert.equal(isSafeInternalReturnPath("/drug-intelligence/map"), true);
});

test("internal map URL with query parameters is accepted", () => {
  assert.equal(isSafeInternalReturnPath("/drug-intelligence/map?province=%E0%B8%8A%E0%B8%B8%E0%B8%A1%E0%B8%9E%E0%B8%A3"), true);
});

test("absolute external URL is rejected", () => {
  assert.equal(isSafeInternalReturnPath("https://evil.example"), false);
  assert.equal(isSafeInternalReturnPath("https://evil.example/drug-intelligence/map"), false);
});

test("protocol-relative URL is rejected", () => {
  assert.equal(isSafeInternalReturnPath("//evil.example"), false);
});

test("javascript: URL is rejected", () => {
  assert.equal(isSafeInternalReturnPath("javascript:alert(1)"), false);
});

test("data: URL is rejected", () => {
  assert.equal(isSafeInternalReturnPath("data:text/html,<script>alert(1)</script>"), false);
});

test("empty/null/undefined input is rejected, never throws", () => {
  assert.equal(isSafeInternalReturnPath(""), false);
  assert.equal(isSafeInternalReturnPath(null), false);
  assert.equal(isSafeInternalReturnPath(undefined), false);
});

test("path not starting with a single leading slash is rejected", () => {
  assert.equal(isSafeInternalReturnPath("drug-intelligence/map"), false);
});

test("a scheme embedded anywhere in the string is rejected, not just at the start", () => {
  assert.equal(isSafeInternalReturnPath("/x?redirect=https://evil.example"), false);
});

test("getSafeReturnTo reads a valid returnTo param", () => {
  const params = new URLSearchParams({ returnTo: "/drug-intelligence/map?province=ชุมพร" });
  assert.equal(getSafeReturnTo(params), "/drug-intelligence/map?province=ชุมพร");
});

test("getSafeReturnTo falls back to null for an unsafe returnTo param", () => {
  const params = new URLSearchParams({ returnTo: "https://evil.example" });
  assert.equal(getSafeReturnTo(params), null);
});

test("getSafeReturnTo returns null when returnTo is absent", () => {
  const params = new URLSearchParams({ focusType: "CASE" });
  assert.equal(getSafeReturnTo(params), null);
});

test("withReturnTo appends a validated returnTo onto a target path with no existing query", () => {
  const url = withReturnTo("/drug-intelligence/cases/abc-123", "/drug-intelligence/map");
  assert.equal(url, "/drug-intelligence/cases/abc-123?returnTo=%2Fdrug-intelligence%2Fmap");
});

test("withReturnTo appends with & when the target already has a query string", () => {
  const url = withReturnTo("/drug-intelligence/network?focusType=CASE&focusId=abc", "/drug-intelligence/map");
  assert.equal(url, "/drug-intelligence/network?focusType=CASE&focusId=abc&returnTo=%2Fdrug-intelligence%2Fmap");
});

test("withReturnTo no-ops (returns target unchanged) when returnPath is unsafe", () => {
  const url = withReturnTo("/drug-intelligence/cases/abc-123", "https://evil.example");
  assert.equal(url, "/drug-intelligence/cases/abc-123");
});

test("withReturnTo no-ops when returnPath is absent", () => {
  const url = withReturnTo("/drug-intelligence/cases/abc-123", undefined);
  assert.equal(url, "/drug-intelligence/cases/abc-123");
});

test("Network page's own returnTo lookup (getSafeReturnTo on its searchParams) is null for a normal direct visit with only focusType/focusId — never falsely implies Map context", () => {
  const params = new URLSearchParams({ focusType: "CASE", focusId: "abc-123" });
  assert.equal(getSafeReturnTo(params), null);
});

test("Case Workspace -> Network link construction forwards a valid Map returnTo end to end", () => {
  const caseId = "abc-123";
  const mapReturnUrl = "/drug-intelligence/map?province=ชุมพร";
  const networkUrl = withReturnTo(`/drug-intelligence/network?focusType=CASE&focusId=${encodeURIComponent(caseId)}`, mapReturnUrl);
  assert.equal(networkUrl, `/drug-intelligence/network?focusType=CASE&focusId=abc-123&returnTo=${encodeURIComponent(mapReturnUrl)}`);
  // The Network page reads it back via getSafeReturnTo on its own searchParams.
  const [, query] = networkUrl.split("?");
  const restored = getSafeReturnTo(new URLSearchParams(query));
  assert.equal(restored, mapReturnUrl);
});

// ── DI-8.1.2: Timeline return-context (reuse the same helper, do not fork security) ──

test("A: valid map returnTo is accepted on a Timeline URL", () => {
  const params = new URLSearchParams({
    caseId: "qa-map-001",
    returnTo: "/drug-intelligence/map",
  });
  assert.equal(getSafeReturnTo(params), "/drug-intelligence/map");
});

test("B: map return URL with query params is preserved on Timeline", () => {
  const mapReturnUrl = "/drug-intelligence/map?province=ชุมพร&status=OPEN";
  const params = new URLSearchParams({
    caseId: "qa-map-001",
    returnTo: mapReturnUrl,
  });
  assert.equal(getSafeReturnTo(params), mapReturnUrl);
});

test("C: missing returnTo on Timeline yields no contextual Back-to-Map action", () => {
  const params = new URLSearchParams({ caseId: "qa-map-001", groupMode: "DAY" });
  assert.equal(getSafeReturnTo(params), null);
});

test("D: invalid external returnTo on Timeline is rejected", () => {
  const params = new URLSearchParams({
    caseId: "qa-map-001",
    returnTo: "https://evil.example/phish",
  });
  assert.equal(getSafeReturnTo(params), null);
});

test("E: protocol-relative returnTo on Timeline is rejected", () => {
  const params = new URLSearchParams({
    caseId: "qa-map-001",
    returnTo: "//evil.example/drug-intelligence/map",
  });
  assert.equal(getSafeReturnTo(params), null);
});

test("F: Timeline → Case forwards a valid map returnTo", () => {
  const caseId = "qa-map-001";
  const mapReturnUrl = "/drug-intelligence/map?province=ชุมพร";
  const caseUrl = withReturnTo(`/drug-intelligence/cases/${encodeURIComponent(caseId)}`, mapReturnUrl);
  assert.equal(caseUrl, `/drug-intelligence/cases/qa-map-001?returnTo=${encodeURIComponent(mapReturnUrl)}`);
  const restored = getSafeReturnTo(new URLSearchParams(caseUrl.split("?")[1]));
  assert.equal(restored, mapReturnUrl);
});

test("G: Timeline → Network forwards a valid map returnTo", () => {
  const caseId = "qa-map-001";
  const mapReturnUrl = "/drug-intelligence/map?province=ชุมพร";
  const networkUrl = withReturnTo(`/drug-intelligence/network?focusType=CASE&focusId=${encodeURIComponent(caseId)}`, mapReturnUrl);
  assert.equal(
    networkUrl,
    `/drug-intelligence/network?focusType=CASE&focusId=qa-map-001&returnTo=${encodeURIComponent(mapReturnUrl)}`
  );
  const restored = getSafeReturnTo(new URLSearchParams(networkUrl.split("?")[1]));
  assert.equal(restored, mapReturnUrl);
});

test("H: Timeline query/filter state remains intact alongside returnTo", () => {
  const params = new URLSearchParams({
    caseId: "qa-map-001",
    groupMode: "DAY",
    sort: "NEWEST_FIRST",
    province: "ชุมพร",
    returnTo: "/drug-intelligence/map?province=ชุมพร",
  });
  assert.equal(getSafeReturnTo(params), "/drug-intelligence/map?province=ชุมพร");
  assert.equal(params.get("caseId"), "qa-map-001");
  assert.equal(params.get("groupMode"), "DAY");
  assert.equal(params.get("sort"), "NEWEST_FIRST");
  assert.equal(params.get("province"), "ชุมพร");
});
