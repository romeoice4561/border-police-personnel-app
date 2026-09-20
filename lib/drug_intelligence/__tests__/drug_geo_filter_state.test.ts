/**
 * DI-8 — URL <-> filter-state round-trip tests (Section 29/37).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyDrugGeoFilterState,
  drugGeoFilterStateFromSearchParams,
  drugGeoFilterStateToSearchParams,
  isDrugGeoFilterStateEmpty,
} from "@/lib/drug_intelligence/drug_geo_filter_state";

test("empty state produces an empty URL (no noisy params)", () => {
  const params = drugGeoFilterStateToSearchParams(createEmptyDrugGeoFilterState());
  assert.equal(params.toString(), "");
});

test("province + district round-trip through the URL", () => {
  const state = { ...createEmptyDrugGeoFilterState(), province: "ชุมพร", district: "ท่าแซะ" };
  const params = drugGeoFilterStateToSearchParams(state);
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.equal(restored.province, "ชุมพร");
  assert.equal(restored.district, "ท่าแซะ");
});

test("numeric org ids round-trip as numbers, not strings", () => {
  const state = { ...createEmptyDrugGeoFilterState(), leadCompanyId: 69, leadBattalionId: 16 };
  const params = drugGeoFilterStateToSearchParams(state);
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.equal(restored.leadCompanyId, 69);
  assert.equal(restored.leadBattalionId, 16);
  assert.equal(typeof restored.leadCompanyId, "number");
});

test("dateFrom/dateTo/status/drugCategory/personId/caseId all round-trip", () => {
  const state = { ...createEmptyDrugGeoFilterState(), dateFrom: "2026-01-01", dateTo: "2026-12-31", status: "OPEN", drugCategory: "METHAMPHETAMINE_TABLET", personId: "abc-123", caseId: "case-456" };
  const params = drugGeoFilterStateToSearchParams(state);
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.equal(restored.dateFrom, "2026-01-01");
  assert.equal(restored.dateTo, "2026-12-31");
  assert.equal(restored.status, "OPEN");
  assert.equal(restored.drugCategory, "METHAMPHETAMINE_TABLET");
  assert.equal(restored.personId, "abc-123");
  assert.equal(restored.caseId, "case-456");
});

test("garbage/non-numeric id values in the URL are ignored, never crash", () => {
  const params = new URLSearchParams("leadCompanyId=not-a-number");
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.equal(restored.leadCompanyId, null);
});

test("isDrugGeoFilterStateEmpty correctly distinguishes empty from non-empty state", () => {
  assert.equal(isDrugGeoFilterStateEmpty(createEmptyDrugGeoFilterState()), true);
  assert.equal(isDrugGeoFilterStateEmpty({ ...createEmptyDrugGeoFilterState(), province: "ชุมพร" }), false);
});

test("weekdays Friday+Saturday round-trip as weekdays=5,6", () => {
  const state = { ...createEmptyDrugGeoFilterState(), weekdays: [5, 6] as const };
  const params = drugGeoFilterStateToSearchParams({ ...state, weekdays: [5, 6] });
  assert.equal(params.get("weekdays"), "5,6");
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.deepEqual(restored.weekdays, [5, 6]);
  assert.equal(isDrugGeoFilterStateEmpty(restored), false);
});

test("timePreset H21_24 round-trips; ALL_DAY omitted from URL", () => {
  const withNight = { ...createEmptyDrugGeoFilterState(), timePreset: "H21_24" as const };
  const params = drugGeoFilterStateToSearchParams(withNight);
  assert.equal(params.get("timePreset"), "H21_24");
  assert.equal(params.get("timeFrom"), null);
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.equal(restored.timePreset, "H21_24");

  const allDay = drugGeoFilterStateToSearchParams(createEmptyDrugGeoFilterState());
  assert.equal(allDay.get("timePreset"), null);
});

test("overnight CUSTOM 20:00–02:00 round-trips (start > end is valid for TIME)", () => {
  const state = {
    ...createEmptyDrugGeoFilterState(),
    timePreset: "CUSTOM" as const,
    timeFrom: "20:00",
    timeTo: "02:00",
  };
  const params = drugGeoFilterStateToSearchParams(state);
  assert.equal(params.get("timePreset"), "CUSTOM");
  assert.equal(params.get("timeFrom"), "20:00");
  assert.equal(params.get("timeTo"), "02:00");
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.equal(restored.timeFrom, "20:00");
  assert.equal(restored.timeTo, "02:00");
  assert.equal(restored.timePreset, "CUSTOM");
});

test("text label fields (headquartersText etc.) are never written to the URL", () => {
  const state = { ...createEmptyDrugGeoFilterState(), companyId: 69, companyText: "ตชด.444" };
  const params = drugGeoFilterStateToSearchParams(state);
  assert.equal(params.has("companyText"), false);
  assert.equal(params.get("companyId"), "69");
});
