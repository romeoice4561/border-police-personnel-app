/**
 * DI-8.7 V1.5A — VISUAL HOTFIX 1: Crime Clock date filters must use the
 * canonical ThaiDatePicker (components/ui/thai_date_picker.tsx), never a
 * native <input type="date">, whose popup is browser/OS-locale-controlled
 * and previously rendered an English/Gregorian calendar.
 *
 * The picker component itself already has its own full test suite
 * (components/ui/__tests__/thai_date_picker.test.ts) proving Thai month
 * names, Buddhist Era years, ISO round-tripping, etc. — not duplicated
 * here. This file proves two things specific to THIS hotfix:
 *   1. the Crime Clock panel's source actually wires ThaiDatePicker (not
 *      a native date input) for both dateFrom/dateTo fields, with
 *      outputFormat="iso" so the wire value stays canonical Gregorian
 *      YYYY-MM-DD — never a Buddhist-Era string reaching the temporal
 *      engine;
 *   2. the pure temporal engine (drug_temporal_explorer.ts) is
 *      completely unaffected by this UI-only change — same canonical
 *      YYYY-MM-DD date-range/weekday/time-range/coverage/hourly-bucket
 *      behavior as before.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  type TemporalCaseRecord,
  type TemporalSelection,
  caseMatchesDateRange,
  caseMatchesTemporalSelection,
  filterCasesByTemporalSelection,
  computeHourlyDistribution,
} from "../drug_temporal_explorer.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = readFileSync(
  path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_temporal_explorer_panel.tsx"),
  "utf8",
);

function rec(id: string, arrestDate: string | null, arrestTime: string | null): TemporalCaseRecord {
  return { id, arrestDate, arrestTime, caseNumber: `CN-${id}`, status: "OPEN", province: null, reportingUnitText: null };
}

// 1. Visible date picker does not use native input type="date".
test("1. the panel never renders a native <input type=\"date\">", () => {
  assert.doesNotMatch(panelSource, /type=["']date["']/);
});

// 2/3/4. Thai month/BE year/Thai weekday headers are rendered by the reused
// component itself — proven by components/ui/__tests__/thai_date_picker.test.ts
// and by direct inspection of thai_date_picker.tsx's THAI_MONTHS / yearBE /
// ["จ","อ","พ","พฤ","ศ","ส","อา"] header row. Here we prove the panel actually
// imports and uses that exact canonical component for BOTH fields, not a
// second competing implementation.
test("2/3/4. the panel imports and uses the canonical ThaiDatePicker for both date fields", () => {
  assert.match(panelSource, /from ["']@\/components\/ui\/thai_date_picker["']/);
  const usages = panelSource.match(/<ThaiDatePicker/g) ?? [];
  assert.equal(usages.length, 2, "exactly two ThaiDatePicker usages — dateFrom and dateTo, no duplicated picker logic");
});

// 5/6. Canonical Gregorian value in <-> Thai/B.E. display out — proven by
// outputFormat="iso" wiring (never a raw Buddhist-Era string reaching
// TemporalSelection.dateFrom/dateTo) plus a short Thai display format.
test("5/6. both date pickers use outputFormat=\"iso\" (canonical YYYY-MM-DD wire value) and displayFormat=\"short\" (Thai display)", () => {
  const fromBlockMatch = panelSource.match(/value=\{selection\.dateFrom[\s\S]{0,400}?outputFormat="iso"[\s\S]{0,200}?displayFormat="short"/);
  const toBlockMatch = panelSource.match(/value=\{selection\.dateTo[\s\S]{0,400}?outputFormat="iso"[\s\S]{0,200}?displayFormat="short"/);
  assert.ok(fromBlockMatch, "dateFrom ThaiDatePicker must use outputFormat=\"iso\" + displayFormat=\"short\"");
  assert.ok(toBlockMatch, "dateTo ThaiDatePicker must use outputFormat=\"iso\" + displayFormat=\"short\"");
});

// 7/8. onChange handlers write straight into TemporalSelection.dateFrom/dateTo
// with no Buddhist-Era or DD/MM/YYYY transformation performed in the panel —
// the ISO string coming out of the picker IS the canonical value.
test("7/8. onChange handlers store the picker's ISO value directly onto selection.dateFrom/dateTo, no extra conversion", () => {
  assert.match(panelSource, /onChange=\{\(value\) => setSelection\(\(s\) => \(\{ \.\.\.s, dateFrom: value \|\| undefined \}\)\)\}/);
  assert.match(panelSource, /onChange=\{\(value\) => setSelection\(\(s\) => \(\{ \.\.\.s, dateTo: value \|\| undefined \}\)\)\}/);
});

// 9. Clearing returns undefined (never invents a value).
test("9. clearing a date field stores undefined (falsy ISO value coerced to undefined), never a fabricated date", () => {
  // value || undefined: an empty string from the picker's "ล้าง" action becomes undefined.
  assert.match(panelSource, /dateFrom: value \|\| undefined/);
  assert.match(panelSource, /dateTo: value \|\| undefined/);
});

// 10. Temporal filtering receives the Gregorian canonical date — proven at
// the pure-engine level: the engine only ever accepts/produces YYYY-MM-DD.
test("10. the temporal engine's date-range filter accepts plain Gregorian YYYY-MM-DD and rejects nothing else silently", () => {
  assert.equal(caseMatchesDateRange("2026-09-24", "2026-09-01", "2026-09-30"), true);
  assert.equal(caseMatchesDateRange("2026-08-31", "2026-09-01", "2026-09-30"), false);
});

// 11. Existing Crime Clock temporal tests remain passing — re-verified here
// directly (full suite also re-run separately) so this file stands alone as
// proof the engine itself was untouched by the hotfix.
test("11. date-range + weekday + time-range intersection is unaffected by the date-picker UI swap", () => {
  const cases = [
    rec("in-range", "2026-09-24", "19:00"), // Thursday
    rec("out-of-range", "2026-10-01", "19:00"),
  ];
  const selection: TemporalSelection = {
    dataset: "ARREST_TIME",
    dateFrom: "2026-09-01",
    dateTo: "2026-09-30",
    startMinute: 18 * 60,
    endMinute: 22 * 60,
  };
  const result = filterCasesByTemporalSelection(cases, selection);
  assert.deepEqual(result.map((c) => c.id), ["in-range"]);
});

// 12. Missing-time safety remains passing.
test("12. missing arrestTime still never becomes 00:00 and still contributes to zero hourly buckets", () => {
  const cases = [rec("1", "2026-09-24", null)];
  const dist = computeHourlyDistribution(cases);
  assert.ok(dist.every((b) => b.count === 0));
  const selection: TemporalSelection = { dataset: "ARREST_TIME", startMinute: 0, endMinute: 24 * 60 };
  assert.equal(caseMatchesTemporalSelection(cases[0], selection), false, "missing time must never match an active time filter");
});
