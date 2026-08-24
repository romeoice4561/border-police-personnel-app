/**
 * Tests for the pure timeline KPI / geographic-aggregate / correlation
 * helpers (Phase DI-7, Sections 3, 9, 10, 18). No database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeDrugTimelineKpi, computeDrugGeographicAggregate, computeDrugTimelineCorrelations } from "@/lib/drug_intelligence/drug_timeline_correlation";
import type { DrugTimelineEvent } from "@/lib/drug_intelligence/drug_timeline_types";

function event(overrides: Partial<DrugTimelineEvent> = {}): DrugTimelineEvent {
  return {
    caseId: "case-1",
    caseNumber: "QA-001",
    title: "ทดสอบ",
    status: "OPEN",
    arrestDate: new Date("2026-08-01"),
    province: "ชุมพร",
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    hasCoordinates: false,
    reportingUnitText: null,
    personCount: 1,
    persons: [{ personId: "p1", primaryFullName: "นาย เอ", role: "SUSPECT" }],
    phoneCount: 0,
    simCount: 0,
    deviceCount: 0,
    vehicleCount: 0,
    seizedItemCount: 0,
    seizedItemsSummary: "",
    hasUnreviewedAlert: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// KPI (Section 3)

test("eventCount and provinceCount reflect the input set exactly", () => {
  const events = [event({ caseId: "c1", province: "ชุมพร" }), event({ caseId: "c2", province: "ระนอง" }), event({ caseId: "c3", province: "ชุมพร" })];
  const kpi = computeDrugTimelineKpi(events);
  assert.equal(kpi.eventCount, 3);
  assert.equal(kpi.provinceCount, 2);
});

test("personsRepeatedAcrossAreas counts only persons whose events span 2+ DISTINCT provinces — never merely 2+ events in the same province", () => {
  const events = [
    event({ caseId: "c1", province: "ชุมพร", persons: [{ personId: "pA", primaryFullName: "A", role: "SUSPECT" }] }),
    event({ caseId: "c2", province: "ชุมพร", persons: [{ personId: "pA", primaryFullName: "A", role: "SUSPECT" }] }), // same person, SAME province — not a cross-area repeat
    event({ caseId: "c3", province: "ระนอง", persons: [{ personId: "pB", primaryFullName: "B", role: "SUSPECT" }] }),
    event({ caseId: "c4", province: "ชุมพร", persons: [{ personId: "pB", primaryFullName: "B", role: "SUSPECT" }] }), // pB now spans 2 provinces
  ];
  const kpi = computeDrugTimelineKpi(events);
  assert.equal(kpi.personsRepeatedAcrossAreas, 1, "only pB (2 distinct provinces) should count, not pA (same province twice)");
});

test("areasWithRepeatEvents counts a province with 2+ events, never a province with exactly 1", () => {
  const events = [event({ caseId: "c1", province: "ชุมพร" }), event({ caseId: "c2", province: "ชุมพร" }), event({ caseId: "c3", province: "ระนอง" })];
  const kpi = computeDrugTimelineKpi(events);
  assert.equal(kpi.areasWithRepeatEvents, 1);
});

test("dateRangeFrom/To reflect the min/max arrestDate, ignoring null dates", () => {
  const events = [event({ caseId: "c1", arrestDate: new Date("2026-08-05") }), event({ caseId: "c2", arrestDate: new Date("2026-08-01") }), event({ caseId: "c3", arrestDate: null })];
  const kpi = computeDrugTimelineKpi(events);
  assert.equal(kpi.dateRangeFrom!.toISOString(), new Date("2026-08-01").toISOString());
  assert.equal(kpi.dateRangeTo!.toISOString(), new Date("2026-08-05").toISOString());
});

test("empty event list produces all-zero KPIs and null date range, without throwing", () => {
  const kpi = computeDrugTimelineKpi([]);
  assert.equal(kpi.eventCount, 0);
  assert.equal(kpi.provinceCount, 0);
  assert.equal(kpi.dateRangeFrom, null);
  assert.equal(kpi.dateRangeTo, null);
});

// ---------------------------------------------------------------------
// Geographic aggregate (Section 9)

test("aggregates only province/district values ACTUALLY present in the data — never a fabricated hierarchy", () => {
  const events = [event({ caseId: "c1", province: "ชุมพร", district: "เมืองชุมพร" }), event({ caseId: "c2", province: "ชุมพร", district: "เมืองชุมพร" }), event({ caseId: "c3", province: "ระนอง", district: null })];
  const rows = computeDrugGeographicAggregate(events);
  assert.equal(rows.length, 2);
  const chumphon = rows.find((r) => r.province === "ชุมพร")!;
  assert.equal(chumphon.caseCount, 2);
  assert.equal(chumphon.district, "เมืองชุมพร");
});

test("events with no province are excluded from the aggregate entirely", () => {
  const events = [event({ caseId: "c1", province: null })];
  const rows = computeDrugGeographicAggregate(events);
  assert.deepEqual(rows, []);
});

test("rows are sorted by caseCount descending, deterministic tie-break by province name", () => {
  const events = [event({ caseId: "c1", province: "ระนอง" }), event({ caseId: "c2", province: "ชุมพร" }), event({ caseId: "c3", province: "ชุมพร" })];
  const rows = computeDrugGeographicAggregate(events);
  assert.deepEqual(rows.map((r) => r.province), ["ชุมพร", "ระนอง"]);
});

// ---------------------------------------------------------------------
// Correlation (Section 10) — deterministic, never probabilistic; wording never claims proof.

test("SHARED_LOCATION_MULTI_PERSON fires when 2+ distinct persons have events in the same province", () => {
  const events = [
    event({ caseId: "c1", province: "ชุมพร", persons: [{ personId: "pA", primaryFullName: "A", role: "SUSPECT" }] }),
    event({ caseId: "c2", province: "ชุมพร", persons: [{ personId: "pB", primaryFullName: "B", role: "SUSPECT" }] }),
  ];
  const correlations = computeDrugTimelineCorrelations(events, 30);
  const found = correlations.find((c) => c.kind === "SHARED_LOCATION_MULTI_PERSON" && c.province === "ชุมพร");
  assert.ok(found);
  assert.ok(found!.explanation.includes("ควรตรวจสอบ"), "must use the neutral 'should investigate further' wording, never a proof claim");
});

test("SHARED_LOCATION_MULTI_PERSON does NOT fire for a single person with multiple events in one province", () => {
  const events = [
    event({ caseId: "c1", province: "ชุมพร", persons: [{ personId: "pA", primaryFullName: "A", role: "SUSPECT" }] }),
    event({ caseId: "c2", province: "ชุมพร", persons: [{ personId: "pA", primaryFullName: "A", role: "SUSPECT" }] }),
  ];
  const correlations = computeDrugTimelineCorrelations(events, 30);
  assert.ok(!correlations.some((c) => c.kind === "SHARED_LOCATION_MULTI_PERSON"));
});

test("TIME_WINDOW_CLUSTER fires when 2 events in the same province occur within the configured day window", () => {
  const events = [event({ caseId: "c1", province: "ชุมพร", arrestDate: new Date("2026-08-01") }), event({ caseId: "c2", province: "ชุมพร", arrestDate: new Date("2026-08-05") })];
  const correlations = computeDrugTimelineCorrelations(events, 7);
  assert.ok(correlations.some((c) => c.kind === "TIME_WINDOW_CLUSTER"));
});

test("TIME_WINDOW_CLUSTER does NOT fire when events fall outside the configured day window", () => {
  const events = [event({ caseId: "c1", province: "ชุมพร", arrestDate: new Date("2026-08-01") }), event({ caseId: "c2", province: "ชุมพร", arrestDate: new Date("2026-09-15") })];
  const correlations = computeDrugTimelineCorrelations(events, 7);
  assert.ok(!correlations.some((c) => c.kind === "TIME_WINDOW_CLUSTER"));
});

test("TIME_WINDOW_CLUSTER does NOT fire across DIFFERENT provinces even within the time window — correlation is scoped per-province, never cross-province", () => {
  const events = [event({ caseId: "c1", province: "ชุมพร", arrestDate: new Date("2026-08-01") }), event({ caseId: "c2", province: "ระนอง", arrestDate: new Date("2026-08-02") })];
  const correlations = computeDrugTimelineCorrelations(events, 7);
  assert.ok(!correlations.some((c) => c.kind === "TIME_WINDOW_CLUSTER"));
});

test("correlation is deterministic — same input always produces the same output", () => {
  const events = [event({ caseId: "c1", province: "ชุมพร", persons: [{ personId: "pA", primaryFullName: "A", role: "SUSPECT" }] }), event({ caseId: "c2", province: "ชุมพร", persons: [{ personId: "pB", primaryFullName: "B", role: "SUSPECT" }] })];
  const first = computeDrugTimelineCorrelations(events, 30);
  const second = computeDrugTimelineCorrelations(events, 30);
  assert.deepEqual(first, second);
});

test("no correlation explanation ever claims proven association or physical travel", () => {
  const events = [
    event({ caseId: "c1", province: "ชุมพร", arrestDate: new Date("2026-08-01"), persons: [{ personId: "pA", primaryFullName: "A", role: "SUSPECT" }] }),
    event({ caseId: "c2", province: "ชุมพร", arrestDate: new Date("2026-08-03"), persons: [{ personId: "pB", primaryFullName: "B", role: "SUSPECT" }] }),
  ];
  const correlations = computeDrugTimelineCorrelations(events, 30);
  for (const c of correlations) {
    assert.ok(!c.explanation.includes("เดินทางจาก"), "must never claim actual travel");
    assert.ok(!c.explanation.includes("เครือข่ายเดียวกัน"), "must never state 'same network' as fact");
  }
});
