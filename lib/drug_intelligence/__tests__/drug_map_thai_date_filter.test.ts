/**
 * Map filter Thai date picker + DI-8.2.1 temporal filter contracts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveMapDatePresetRange } from "@/lib/drug_intelligence/drug_map_temporal";
import { drugGeoFilterStateFromSearchParams, drugGeoFilterStateToSearchParams, createEmptyDrugGeoFilterState } from "@/lib/drug_intelligence/drug_geo_filter_state";
import { normalizeDrugMapQueryInput, DrugMapQueryInvalidFilterError } from "@/lib/drug_intelligence/drug_map_query";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";

const ROOT = process.cwd();
const panel = readFileSync(join(ROOT, "components/drug_intelligence/drug_geo_filter_panel.tsx"), "utf8");
const mapPage = readFileSync(join(ROOT, "app/drug-intelligence/map/page.tsx"), "utf8");
const personsPage = readFileSync(join(ROOT, "app/drug-intelligence/persons/page.tsx"), "utf8");

test("Map filter panel uses ThaiDatePicker, not native date input", () => {
  assert.match(panel, /ThaiDatePicker/);
  assert.match(panel, /outputFormat="iso"/);
  assert.match(panel, /displayFormat="short"/);
  assert.match(panel, /data-testid="map-filter-date-from"/);
  assert.match(panel, /data-testid="map-filter-date-to"/);
  assert.doesNotMatch(panel, /type="date"/);
  assert.doesNotMatch(panel, /mm\/dd\/yyyy/i);
  assert.doesNotMatch(panel, /placeholder="DD\/MM\/YYYY"/);
});

test("Map temporal filter section includes weekday and time-of-day controls", () => {
  assert.match(panel, /data-testid="map-temporal-filters"/);
  assert.match(panel, /data-testid="map-date-range-filters"/);
  assert.match(panel, /data-testid="map-weekday-filters"/);
  assert.match(panel, /data-testid="map-time-of-day-filters"/);
  assert.match(panel, /resolveMapDatePresetRange/);
  assert.match(panel, /ThaiTimePicker/);
  assert.match(panel, /variant="popover"/);
  assert.doesNotMatch(panel, /type="time"/);
});

test("UI selection 1 Aug 2569 maps to ISO 2026-08-01 in filter/URL contract", () => {
  const state = createEmptyDrugGeoFilterState();
  state.dateFrom = "2026-08-01";
  state.dateTo = "2026-08-10";
  const params = drugGeoFilterStateToSearchParams(state);
  assert.equal(params.get("dateFrom"), "2026-08-01");
  assert.equal(params.get("dateTo"), "2026-08-10");
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.equal(restored.dateFrom, "2026-08-01");
  assert.equal(restored.dateTo, "2026-08-10");
  assert.equal(formatShortThaiDateTh(new Date("2026-08-01T00:00:00.000Z")), "1 ส.ค. 2569");
});

test("DATE-only timezone safety: chip/display calendar day never shifts", () => {
  assert.equal(formatShortThaiDateTh(new Date("2026-08-01T00:00:00.000Z")), "1 ส.ค. 2569");
  assert.equal(formatShortThaiDateTh(new Date("2026-08-10T00:00:00.000Z")), "10 ส.ค. 2569");
});

test("start/end range: start > end is rejected by map query normalization", () => {
  assert.throws(
    () => normalizeDrugMapQueryInput({ dateFrom: "2026-08-10", dateTo: "2026-08-01" }),
    DrugMapQueryInvalidFilterError,
  );
  assert.match(panel, /map-date-range-invalid/);
  assert.match(panel, /filterDateRangeInvalid/);
});

test("presets still resolve to YYYY-MM-DD pairs", () => {
  const fixed = new Date("2026-08-15T12:00:00.000Z");
  const today = resolveMapDatePresetRange("TODAY", fixed);
  assert.equal(today.dateFrom, "2026-08-15");
  assert.equal(today.dateTo, "2026-08-15");
  const month = resolveMapDatePresetRange("THIS_MONTH", fixed);
  assert.equal(month.dateFrom, "2026-08-01");
  assert.equal(month.dateTo, "2026-08-31");
  const last7 = resolveMapDatePresetRange("LAST_7", fixed);
  assert.equal(last7.dateFrom, "2026-08-09");
  assert.equal(last7.dateTo, "2026-08-15");
  assert.match(panel, /resolveMapDatePresetRange/);
});

test("clear/reset empties dateFrom/dateTo in URL serialization", () => {
  const cleared = createEmptyDrugGeoFilterState();
  const params = drugGeoFilterStateToSearchParams(cleared);
  assert.equal(params.get("dateFrom"), null);
  assert.equal(params.get("dateTo"), null);
  assert.match(mapPage, /clearAll/);
});

test("Persons advanced search also uses ThaiDatePicker (no remaining DI native date in that page)", () => {
  assert.match(personsPage, /ThaiDatePicker/);
  assert.doesNotMatch(personsPage, /type="date"/);
});

test("Map page has no native date input and no mm/dd/yyyy copy", () => {
  assert.doesNotMatch(mapPage, /type="date"/);
  assert.doesNotMatch(mapPage, /mm\/dd\/yyyy/i);
  assert.match(mapPage, /DrugGeoFilterPanel/);
  assert.match(mapPage, /DrugGeoTemporalSummary/);
});
