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

test("text label fields (headquartersText etc.) are never written to the URL", () => {
  const state = { ...createEmptyDrugGeoFilterState(), companyId: 69, companyText: "ตชด.444" };
  const params = drugGeoFilterStateToSearchParams(state);
  assert.equal(params.has("companyText"), false);
  assert.equal(params.get("companyId"), "69");
});
