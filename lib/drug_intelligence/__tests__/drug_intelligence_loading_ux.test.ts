/**
 * DI-9.4.3A — route loading UX + region config + sidebar pending wiring,
 * plus Map DI-8.2.1 / Network permission non-regression (source-level).
 *
 * No React render harness in this repo — assert contracts at source level
 * (same pattern as drug_geo_map_page_navigation.test.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..", "..", "..");

const loadingPath = path.join(root, "app", "drug-intelligence", "loading.tsx");
const shellPath = path.join(root, "components", "layout", "app_shell.tsx");
const mapPath = path.join(root, "app", "drug-intelligence", "map", "page.tsx");
const networkPagePath = path.join(root, "app", "drug-intelligence", "network", "page.tsx");
const vercelPath = path.join(root, "vercel.json");

test("shared Drug Intelligence loading.tsx exists at the segment root", () => {
  assert.equal(existsSync(loadingPath), true);
});

test("loading UI uses skeleton surfaces and exposes di-route-loading test id", () => {
  const source = readFileSync(loadingPath, "utf8");
  const src = source.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(src, /data-testid=["']di-route-loading["']/);
  assert.match(src, /\bSkeleton\b/);
  assert.match(src, /\bLoadingState\b/);
  assert.match(src, /role=["']status["']/);
  assert.match(src, /aria-busy=["']true["']/);
  assert.doesNotMatch(src, /%\s*complete/i);
});

test("vercel.json pins serverless regions to sin1 (Singapore)", () => {
  assert.equal(existsSync(vercelPath), true);
  const cfg = JSON.parse(readFileSync(vercelPath, "utf8")) as { regions?: string[] };
  assert.deepEqual(cfg.regions, ["sin1"]);
});

test("AppShell tracks pendingHref and clears it when pathname changes", () => {
  const src = readFileSync(shellPath, "utf8");
  assert.match(src, /useState<\s*string\s*\|\s*null\s*>\(\s*null\s*\)/);
  assert.match(src, /setPendingHref\(null\)/);
  assert.match(src, /pendingForPathname/);
  assert.match(src, /pendingHref/);
  assert.match(src, /data-pending/);
  assert.match(src, /aria-busy/);
  assert.match(src, /isNavItemHighlighted/);
});

test("DI nav permission gates remain drug.read / drug.create (RBAC unchanged)", () => {
  const src = readFileSync(shellPath, "utf8");
  const start = src.indexOf('titleKey: "nav.groupDrugIntelligence"');
  const end = src.indexOf('titleKey: "nav.groupAdministration"');
  assert.ok(start >= 0 && end > start, "could not locate Drug Intelligence nav group");
  const diBlock = src.slice(start, end);
  const perms = [...diBlock.matchAll(/permission:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(perms.includes("drug.read"));
  assert.ok(perms.includes("drug.create"));
  assert.ok(perms.every((p) => p === "drug.read" || p === "drug.create"));
});

test("Map page still uses window.location.assign for filter navigation (DI-8.2.1)", () => {
  const source = readFileSync(mapPath, "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(code, /window\.location\.assign\(/);
  assert.doesNotMatch(code, /router\.push\(/);
  assert.doesNotMatch(code, /router\.replace\(/);
});

test("Network page Analyst Mode still gates on drug.edit (View/Analyst unaffected)", () => {
  const src = readFileSync(networkPagePath, "utf8");
  assert.match(src, /can\(\s*["']drug\.edit["']\s*\)/);
});
