/**
 * DrugGeoTimeTrendChart readability regression tests.
 *
 * Guards against regression to the stretched-SVG pattern (font-size 6 inside
 * preserveAspectRatio="none") that caused compressed/unreadable Thai month
 * labels at 100% desktop zoom (Map Trend Readability Hotfix).
 *
 * Checks the COMPONENT SOURCE rather than a DOM render, matching the pattern
 * established in drug_commander_dashboard_2c.test.ts for fast, dependency-free
 * assertions on implementation guarantees.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CHART_SRC_FULL = readFileSync(
  join(ROOT, "components/drug_intelligence/drug_geo_time_trend_chart.tsx"),
  "utf8"
);
// Strip block comments so tests target the live code, not doc comments
const CHART_SRC = CHART_SRC_FULL.replace(/\/\*[\s\S]*?\*\//g, "");
const TREND_SRC = readFileSync(
  join(ROOT, "lib/drug_intelligence/drug_geo_time_trend.ts"),
  "utf8"
);
const DICT_SRC = readFileSync(
  join(ROOT, "lib/i18n/dictionary.ts"),
  "utf8"
);

// ── chart implementation guards ───────────────────────────────────────────

test("map trend chart does NOT use stretched SVG with preserveAspectRatio=none", () => {
  // Matches the JSX attribute form, not a comment/doc string
  assert.doesNotMatch(CHART_SRC, /preserveAspectRatio=["']/);
});

test("map trend chart does NOT use tiny inline SVG fontSize for month labels", () => {
  // Reject any fontSize prop on an SVG <text> element
  assert.doesNotMatch(CHART_SRC, /<text[^>]*fontSize=\{[0-9]+\}/);
});

test("map trend chart uses real HTML text elements for month labels (not SVG <text>)", () => {
  // No <text inside the JSX
  assert.doesNotMatch(CHART_SRC, /<text\s/);
});

test("map trend chart month labels use at least 12px text size", () => {
  // Must have text-[12px] or text-xs (12px) for the label span
  assert.match(CHART_SRC, /text-\[12px\]/);
});

test("map trend chart exposes a data-testid for regression targeting", () => {
  assert.match(CHART_SRC, /data-testid="map-trend-chart"/);
});

test("map trend chart has accessible role=img and aria-label", () => {
  assert.match(CHART_SRC, /role="img"/);
  assert.match(CHART_SRC, /aria-label=\{ariaLabel\}/);
});

test("map trend chart has sr-only textual summary", () => {
  assert.match(CHART_SRC, /sr-only/);
});

test("map trend chart tooltip uses di.map.trendTooltip i18n key", () => {
  assert.match(CHART_SRC, /di\.map\.trendTooltip/);
});

// ── i18n dictionary completeness ─────────────────────────────────────────

test("di.map.trendTooltip key exists in the i18n dictionary", () => {
  assert.match(DICT_SRC, /"di\.map\.trendTooltip"/);
});

test("di.map.trendTooltip contains {count} placeholder", () => {
  // Extract the value from the dictionary
  const match = DICT_SRC.match(/"di\.map\.trendTooltip"[^,\n]*tr\("([^"]+)"/);
  assert.ok(match, "di.map.trendTooltip key should be in dictionary");
  assert.match(match[1], /\{count\}/);
});

// ── Thai month labels ─────────────────────────────────────────────────────

test("drug_geo_time_trend exports all 12 Thai month abbreviations", () => {
  const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  for (const m of thaiMonths) {
    assert.match(TREND_SRC, new RegExp(m.replace(".", "\\.")));
  }
});

test("drugGeoTrendMonthLabel returns มิ.ย. for month 6", async () => {
  const { drugGeoTrendMonthLabel } = await import("@/lib/drug_intelligence/drug_geo_time_trend");
  const bucket = { monthKey: "2026-06", month: 6, year: 2026, caseCount: 3 };
  assert.equal(drugGeoTrendMonthLabel(bucket, "th"), "มิ.ย.");
});

test("drugGeoTrendMonthLabel returns ส.ค. for month 8", async () => {
  const { drugGeoTrendMonthLabel } = await import("@/lib/drug_intelligence/drug_geo_time_trend");
  const bucket = { monthKey: "2026-08", month: 8, year: 2026, caseCount: 5 };
  assert.equal(drugGeoTrendMonthLabel(bucket, "th"), "ส.ค.");
});
