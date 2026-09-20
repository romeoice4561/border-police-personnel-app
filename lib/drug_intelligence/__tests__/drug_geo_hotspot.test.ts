/**
 * DI-8.2B — Geographic hotspot engine + area ranking + in-hotspot evidence.
 *
 * Run:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_geo_hotspot.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildDrugGeoHotspotId,
  computeDrugGeoHotspots,
  deriveHotspotRepeatIndicators,
  DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM,
  DRUG_GEO_HOTSPOT_RADIUS_KM_OPTIONS,
  haversineKm,
  hotspotEngineUsesSpatialBucketing,
  parseDrugGeoMapModeParam,
  parseHotspotRadiusKmParam,
  summarizeHotspotTemporal,
  type DrugGeoHotspotEvent,
} from "@/lib/drug_intelligence/drug_geo_hotspot";
import {
  analyzeHotspotCrossCaseEvidence,
  HOTSPOT_PROXIMITY_ONLY_MESSAGE_TH,
  type HotspotCaseEntityMembership,
} from "@/lib/drug_intelligence/drug_geo_hotspot_evidence";
import {
  enrichProvinceRanking,
  enrichDistrictRanking,
  rankDistrictsFromMarkers,
} from "@/lib/drug_intelligence/drug_geo_area_intelligence";
import {
  createEmptyDrugGeoFilterState,
  drugGeoFilterStateFromSearchParams,
  drugGeoFilterStateToSearchParams,
} from "@/lib/drug_intelligence/drug_geo_filter_state";

function event(
  caseId: string,
  lat: number,
  lng: number,
  overrides: Partial<DrugGeoHotspotEvent> = {},
): DrugGeoHotspotEvent {
  return {
    caseId,
    caseNumber: caseId,
    latitude: lat,
    longitude: lng,
    arrestDate: "2026-03-01",
    arrestTime: "18:30",
    province: "ชุมพร",
    district: "ท่าแซะ",
    ...overrides,
  };
}

// ── Distance ────────────────────────────────────────────────────────────

test("haversineKm: ~0 for identical points", () => {
  assert.ok(haversineKm(10.5, 99.1, 10.5, 99.1) < 0.001);
});

test("haversineKm: ~1 km east near equator-ish Thai lat", () => {
  // 1° lon ≈ 111.32 * cos(lat) km; at lat 10 ≈ 109.6 km per degree
  const dLng = 1 / 109.6;
  const d = haversineKm(10, 99, 10, 99 + dLng);
  assert.ok(d > 0.9 && d < 1.1, `expected ~1km got ${d}`);
});

// ── Grouping / deterministic ids / radius ───────────────────────────────

test("hotspot grouping: two nearby events form one hotspot at 3 km", () => {
  const a = event("c1", 10.5, 99.18);
  const b = event("c2", 10.501, 99.181); // ~150 m
  const hotspots = computeDrugGeoHotspots([a, b], 3);
  assert.equal(hotspots.length, 1);
  assert.equal(hotspots[0]!.eventCount, 2);
  assert.deepEqual(hotspots[0]!.caseIds, ["c1", "c2"]);
});

test("hotspot grouping: distant events do not merge at 3 km", () => {
  const a = event("c1", 10.5, 99.18);
  const b = event("c2", 11.5, 100.18); // >> 3 km
  assert.equal(computeDrugGeoHotspots([a, b], 3).length, 0);
});

test("hotspot ids are deterministic for same members + radius", () => {
  const events = [event("b", 10.5, 99.18), event("a", 10.501, 99.181)];
  const h1 = computeDrugGeoHotspots(events, 3);
  const h2 = computeDrugGeoHotspots([...events].reverse(), 3);
  assert.equal(h1[0]!.hotspotId, h2[0]!.hotspotId);
  assert.equal(h1[0]!.hotspotId, buildDrugGeoHotspotId(3, ["a", "b"]));
});

test("radius change: 0.5 km may split what 3 km merges", () => {
  // ~2 km apart
  const a = event("c1", 10.5, 99.18);
  const b = event("c2", 10.518, 99.18);
  assert.equal(computeDrugGeoHotspots([a, b], 3).length, 1);
  assert.equal(computeDrugGeoHotspots([a, b], 0.5).length, 0);
});

test("default radius is 3 km and options include required set", () => {
  assert.equal(DRUG_GEO_HOTSPOT_DEFAULT_RADIUS_KM, 3);
  assert.deepEqual([...DRUG_GEO_HOTSPOT_RADIUS_KM_OPTIONS], [0.5, 1, 3, 5, 10]);
});

test("spatial bucketing contract — no naïve full pairwise source pattern", () => {
  assert.equal(hotspotEngineUsesSpatialBucketing(), true);
  const src = readFileSync(join(process.cwd(), "lib/drug_intelligence/drug_geo_hotspot.ts"), "utf8");
  assert.match(src, /UnionFind/);
  assert.match(src, /buckets/);
  // Must not nest a full i/j loop over valid.length without cell neighbor gate
  assert.doesNotMatch(src, /for \(let i = 0; i < valid\.length; i \+= 1\) \{\s*for \(let j = i \+ 1; j < valid\.length/);
});

test("unknown coordinates are ignored", () => {
  const hotspots = computeDrugGeoHotspots(
    [
      event("c1", 10.5, 99.18),
      { caseId: "bad", latitude: Number.NaN, longitude: 99 },
      event("c2", 10.501, 99.181),
    ],
    3,
  );
  assert.equal(hotspots[0]!.eventCount, 2);
});

// ── Temporal × geography ────────────────────────────────────────────────

test("weekday × geography: Friday peak from hotspot events", () => {
  // 2026-03-06 = Friday
  const events = [
    event("a", 10.5, 99.18, { arrestDate: "2026-03-06", arrestTime: "19:00" }),
    event("b", 10.501, 99.181, { arrestDate: "2026-03-06", arrestTime: "20:00" }),
    event("c", 10.502, 99.182, { arrestDate: "2026-03-07", arrestTime: "10:00" }),
  ];
  const hs = computeDrugGeoHotspots(events, 3)[0]!;
  const temporal = summarizeHotspotTemporal(hs.events);
  assert.equal(temporal.weekdayFrequency[5], 2);
  assert.equal(temporal.peakWeekday, 5);
});

test("time × geography: 18–21 bucket; unknown arrestTime excluded", () => {
  const events = [
    event("a", 10.5, 99.18, { arrestTime: "18:15" }),
    event("b", 10.501, 99.181, { arrestTime: "19:00" }),
    event("c", 10.502, 99.182, { arrestTime: null }),
  ];
  const temporal = summarizeHotspotTemporal(events);
  assert.equal(temporal.timeBucketFrequency.H18_21, 2);
  assert.equal(temporal.coverage.withoutTime, 1);
  assert.equal(temporal.coverage.withTime, 2);
});

test("repeat indicators are descriptive counts only", () => {
  const events = [
    event("a", 10.5, 99.18, { arrestDate: "2026-03-06", arrestTime: "19:00" }),
    event("b", 10.501, 99.181, { arrestDate: "2026-03-06", arrestTime: "20:00" }),
  ];
  const hs = computeDrugGeoHotspots(events, 3)[0]!;
  const lines = deriveHotspotRepeatIndicators(hs);
  assert.ok(lines.some((l) => l.includes("2 เหตุการณ์")));
  assert.ok(!lines.some((l) => /เสี่ยง|จุดค้า|ฐานปฏิบัติการ/.test(l)));
});

// ── Cross-case evidence inside hotspot ──────────────────────────────────

function membership(partial: Partial<HotspotCaseEntityMembership> & { caseId: string }): HotspotCaseEntityMembership {
  return {
    caseId: partial.caseId,
    caseNumber: partial.caseNumber ?? partial.caseId,
    arrestDate: partial.arrestDate ?? "2026-01-01",
    arrestTime: partial.arrestTime ?? null,
    province: partial.province ?? "ชุมพร",
    district: partial.district ?? "ท่าแซะ",
    locationName: partial.locationName ?? null,
    status: partial.status ?? "OPEN",
    personIds: partial.personIds ?? [],
    phoneIds: partial.phoneIds ?? [],
    simIds: partial.simIds ?? [],
    deviceIds: partial.deviceIds ?? [],
    vehicleIds: partial.vehicleIds ?? [],
    locationIds: partial.locationIds ?? [],
    personLabels: partial.personLabels,
    phoneLabels: partial.phoneLabels,
    vehicleLabels: partial.vehicleLabels,
  };
}

test("shared person is DIRECT evidence; geography alone is not", () => {
  const analysis = analyzeHotspotCrossCaseEvidence([
    membership({ caseId: "1", caseNumber: "DI-TEST-001", personIds: ["p1"], personLabels: { p1: "สมชาย" } }),
    membership({ caseId: "2", caseNumber: "DI-TEST-002", personIds: ["p1"], personLabels: { p1: "สมชาย" } }),
  ]);
  assert.equal(analysis.linkedPairCount, 1);
  assert.equal(analysis.proximityOnlyPairCount, 0);
  assert.ok(analysis.pairs[0]!.evidenceLabels.includes("บุคคลเดียวกัน"));
});

test("geographic proximity alone does NOT become DIRECT evidence", () => {
  const analysis = analyzeHotspotCrossCaseEvidence([
    membership({ caseId: "1", caseNumber: "A", personIds: ["p1"] }),
    membership({ caseId: "2", caseNumber: "B", personIds: ["p2"] }),
  ]);
  assert.equal(analysis.linkedPairCount, 0);
  assert.equal(analysis.proximityOnlyPairCount, 1);
  assert.ok(HOTSPOT_PROXIMITY_ONLY_MESSAGE_TH.includes("ยังไม่พบหลักฐานเชื่อมโยงโดยตรง"));
});

test("hotspot case chronology is arrestDate ascending", () => {
  const analysis = analyzeHotspotCrossCaseEvidence([
    membership({ caseId: "2", caseNumber: "B", arrestDate: "2026-02-01" }),
    membership({ caseId: "1", caseNumber: "A", arrestDate: "2026-01-01" }),
  ]);
  assert.deepEqual(
    analysis.chronology.map((c) => c.caseId),
    ["1", "2"],
  );
});

// ── Area ranking ────────────────────────────────────────────────────────

test("province ranking includes percent and coord split", () => {
  const rows = enrichProvinceRanking(
    [
      { province: "ชุมพร", unspecified: false, caseCount: 4, withCoordinates: 3 },
      { province: "ระนอง", unspecified: false, caseCount: 1, withCoordinates: 0 },
    ],
    [
      { province: "ชุมพร", arrestDate: "2026-01-01" },
      { province: "ชุมพร", arrestDate: "2026-03-01" },
    ],
    5,
  );
  assert.equal(rows[0]!.percentOfFiltered, 80);
  assert.equal(rows[0]!.withoutCoordinates, 1);
  assert.equal(rows[0]!.earliestArrestDate, "2026-01-01");
  assert.equal(rows[0]!.latestArrestDate, "2026-03-01");
});

test("district ranking from markers", () => {
  const rows = rankDistrictsFromMarkers(
    [
      { district: "ท่าแซะ", arrestDate: "2026-01-01", hasCoordinates: true },
      { district: "ท่าแซะ", arrestDate: "2026-02-01", hasCoordinates: true },
      { district: "เมืองชุมพร", arrestDate: "2026-01-15", hasCoordinates: true },
    ],
    3,
  );
  assert.equal(rows[0]!.value, "ท่าแซะ");
  assert.equal(rows[0]!.eventCount, 2);
});

test("enrichDistrictRanking respects server aggregates", () => {
  const rows = enrichDistrictRanking(
    [{ district: "ท่าแซะ", unspecified: false, caseCount: 5, withCoordinates: 2 }],
    [{ district: "ท่าแซะ", arrestDate: "2026-01-01" }],
    10,
  );
  assert.equal(rows[0]!.percentOfFiltered, 50);
  assert.equal(rows[0]!.withoutCoordinates, 3);
});

// ── URL / filter composition ────────────────────────────────────────────

test("URL: geoMode=HOTSPOT and hotspotRadiusKm=3 round-trip; default omitted", () => {
  const state = {
    ...createEmptyDrugGeoFilterState(),
    geoMode: "HOTSPOT" as const,
    hotspotRadiusKm: 3 as const,
    weekdays: [5] as const,
    timePreset: "H18_21" as const,
  };
  const params = drugGeoFilterStateToSearchParams({ ...state, weekdays: [5] });
  assert.equal(params.get("geoMode"), "HOTSPOT");
  assert.equal(params.get("hotspotRadiusKm"), null, "default 3 km omitted");
  assert.equal(params.get("weekdays"), "5");
  assert.equal(params.get("timePreset"), "H18_21");
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.equal(restored.geoMode, "HOTSPOT");
  assert.equal(restored.hotspotRadiusKm, 3);
});

test("URL: custom radius 5 km and overnight custom time", () => {
  const state = {
    ...createEmptyDrugGeoFilterState(),
    geoMode: "HOTSPOT" as const,
    hotspotRadiusKm: 5 as const,
    timePreset: "CUSTOM" as const,
    timeFrom: "22:00",
    timeTo: "02:00",
  };
  const params = drugGeoFilterStateToSearchParams(state);
  assert.equal(params.get("hotspotRadiusKm"), "5");
  assert.equal(params.get("timeFrom"), "22:00");
  assert.equal(params.get("timeTo"), "02:00");
  const restored = drugGeoFilterStateFromSearchParams(params);
  assert.equal(restored.hotspotRadiusKm, 5);
  assert.equal(restored.timePreset, "CUSTOM");
});

test("parse helpers reject garbage geoMode/radius", () => {
  assert.equal(parseDrugGeoMapModeParam("NOPE"), "POINTS");
  assert.equal(parseHotspotRadiusKmParam("99"), 3);
  assert.equal(parseHotspotRadiusKmParam("1"), 1);
});

test("empty states: zero events → no hotspots; single event → no hotspot", () => {
  assert.deepEqual(computeDrugGeoHotspots([], 3), []);
  assert.deepEqual(computeDrugGeoHotspots([event("only", 10, 99)], 3), []);
});
