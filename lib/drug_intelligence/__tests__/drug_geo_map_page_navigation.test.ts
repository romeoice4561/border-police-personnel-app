/**
 * DI-8.2.1 — regression test for a production-only defect where Clear All
 * (and every other filter change) silently stopped updating the URL.
 *
 * Root cause (confirmed via a local `next build && next start` production
 * build and the live Vercel deployment — never reproducible under
 * `next dev`): once app/drug-intelligence/map/page.tsx was hard-loaded
 * from a URL that already carried search params (e.g. any personId/
 * caseId/province deep link, a bookmark, or a browser refresh), the
 * Next.js client router's internal navigation handling for THIS route
 * became permanently unable to process any later same-pathname
 * router.push()/router.replace() call for the rest of that page's
 * lifetime — history.pushState was never invoked, the URL never changed,
 * no console error was raised, and no combination of router.push,
 * router.replace, router.refresh, a manual history.pushState alongside
 * router.push, startTransition, an absolute-URL target, or a
 * self-referential router.replace()-on-mount "priming" call fixed it —
 * only bypassing the client router with a real browser navigation
 * (window.location.assign) did.
 *
 * The page was also missing a <Suspense> boundary around its
 * useSearchParams() usage (the one page in this app's drug-intelligence
 * section that was) — that alone did NOT fix the defect, but is still
 * correct and was kept, matching every other page's convention.
 *
 * No React rendering harness exists in this codebase (all tests are pure
 * logic/source-level checks, and only lib/**\/__tests__ is picked up by
 * `npm test` — see package.json's test glob) — this asserts the contract
 * at the source level.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "map", "page.tsx"), "utf8");
// Strip the file's block comments before asserting on CODE — the top doc
// comment intentionally narrates the investigation in prose and mentions
// "router.push"/"router.replace" as things that were tried and rejected;
// asserting against the raw source (comments included) would false-fail
// on the very comment explaining why they're absent from the code.
const code = source.replace(/\/\*[\s\S]*?\*\//g, "");

test("Suspense is imported from react and wraps the default-exported page component", () => {
  assert.match(code, /import\s*\{[^}]*\bSuspense\b[^}]*\}\s*from\s*["']react["']/);
  const defaultExportMatch = code.match(/export default function \w+\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(defaultExportMatch, "could not locate the default-exported component");
  assert.match(defaultExportMatch![1], /<Suspense\b/);
});

test("useSearchParams is called inside the Suspense-wrapped inner component, not the default export directly", () => {
  const defaultExportMatch = code.match(/export default function \w+\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(defaultExportMatch);
  assert.doesNotMatch(defaultExportMatch![1], /useSearchParams\(/);
});

test("useSearchParams is still used somewhere in the file (URL-filter-state reading must not be removed)", () => {
  assert.match(code, /useSearchParams\(/);
});

test("applyFilters and clearAll both exist and both navigate via window.location.assign, not router.push/replace", () => {
  assert.match(code, /const applyFilters = useCallback/);
  assert.match(code, /const clearAll = useCallback/);
  assert.match(code, /window\.location\.assign\(/);
  // The actual defect: router.push/replace silently no-op'd for this route
  // after a hard load with search params. The fix deliberately does not
  // call either for filter navigation — assert neither call site (nor a
  // useRouter() import, which would be otherwise-unused dead code) remains
  // in the CODE (comments narrating the investigation are stripped above).
  assert.doesNotMatch(code, /router\.push\(/);
  assert.doesNotMatch(code, /router\.replace\(/);
  assert.doesNotMatch(code, /import\s*\{[^}]*\buseRouter\b[^}]*\}\s*from\s*["']next\/navigation["']/);
});

test("applyFilters merges the patch into current filters before navigating (must not drop existing filters)", () => {
  const fnMatch = code.match(/const applyFilters = useCallback\(\s*\(patch: Partial<DrugGeoFilterState>\) => \{([\s\S]*?)\},\s*\[/);
  assert.ok(fnMatch, "could not locate applyFilters body");
  assert.match(fnMatch![1], /\{\s*\.\.\.filters,\s*\.\.\.patch\s*\}/);
});

test("clearAll clears map filters and may only preserve safe inbound returnTo", () => {
  const fnMatch = code.match(/const clearAll = useCallback\(\(\) => \{([\s\S]*?)\},\s*\[/);
  assert.ok(fnMatch, "could not locate clearAll body");
  const body = fnMatch![1];
  assert.match(body, /navigateToMapUrl\(`/);
  assert.match(body, /\/drug-intelligence\/map/);
  // Filter query state must not be re-applied on clear — only optional returnTo.
  assert.doesNotMatch(body, /drugGeoFilterStateToSearchParams/);
  assert.match(body, /inboundReturnTo/);
});

test("both applyFilters and clearAll route through the same shared navigation helper (no drift between the two call sites)", () => {
  const helperCalls = code.match(/navigateToMapUrl\(/g) ?? [];
  // 1 definition site (`const navigateToMapUrl = ...`) does not itself match
  // this pattern (no trailing paren after the identifier in the same way),
  // so this should count exactly the 2 call sites: applyFilters + clearAll.
  assert.equal(helperCalls.length, 2, `expected exactly 2 navigateToMapUrl(...) call sites, found ${helperCalls.length}`);
});
