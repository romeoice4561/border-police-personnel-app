/**
 * DI-8.1.2 — Map seizure unit consistency. The Map popup, result list, and
 * province breakdown all render `displayTh` from groupSeizedItemFacts; this
 * file asserts that string matches Case Workspace's stored-unit display.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/di812_seizure_unit_consistency.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugGeoIntelligenceService } from "@/lib/drug_intelligence/drug_geo_intelligence_service";
import { groupSeizedItemFacts } from "@/lib/drug_intelligence/officer_drug_arrest_performance";
import { formatSeizedItemDisplayTh, resolveDrugSeizedItemAnalyticsView } from "@/lib/drug_intelligence/drug_seized_item_analytics";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "ตชด.44-2569-001",
    title: "จับกุมยาเสพติดทดสอบ",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: "14:30",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    province: "ชุมพร",
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: 10.4934,
    longitude: 99.18,
    narrative: "เหตุการณ์ทดสอบ",
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

/** Same formula Case Workspace SeizedTab uses for a COUNT row. */
function caseWorkspaceCountDisplay(categoryLabelTh: string, quantity: number, unit: string | null): string {
  const qty = quantity.toLocaleString("th-TH");
  return unit ? `${categoryLabelTh} ${qty} ${unit}` : `${categoryLabelTh} ${qty}`;
}

test("A: COUNT/tablet item displays เม็ด", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "QA-MAP-UNIT-A",
      seizedItems: [{ drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 5000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null }],
    })
  );
  const result = await new DrugGeoIntelligenceService({ db }).getGeoResult({ page: 1, pageSize: 20 });
  assert.equal(result.markers[0].seizedItems[0].displayTh, "ยาบ้า 5,000 เม็ด");
});

test("B: MASS item displays canonical mass unit (กก.)", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "QA-MAP-UNIT-B",
      seizedItems: [{ drugCategory: "CRYSTAL_METHAMPHETAMINE", otherDrugCategoryLabel: null, measurementKind: "MASS", drugType: "ไอซ์", subtype: null, quantity: null, unit: null, weightGrams: 500, packageCount: null, notes: null }],
    })
  );
  const result = await new DrugGeoIntelligenceService({ db }).getGeoResult({ page: 1, pageSize: 20 });
  assert.equal(result.markers[0].seizedItems[0].displayTh, "ไอซ์ 0.5 กก.");
});

test("C: LIQUID-style COUNT item preserves the stored liquid unit", () => {
  const groups = groupSeizedItemFacts([
    { drugCategory: "KETAMINE", otherDrugCategoryLabel: null, measurementKind: "COUNT", normalizedCount: 250, normalizedWeightGrams: null, displayUnit: "มล." },
  ]);
  assert.equal(groups[0].displayTh, "เคตามีน 250 มล.");
  assert.equal(groups[0].displayUnit, "มล.");
});

test("D: custom/OTHER unit preserves the stored display unit", () => {
  const groups = groupSeizedItemFacts([
    { drugCategory: "OTHER", otherDrugCategoryLabel: "ยาแก้ไอ", measurementKind: "COUNT", normalizedCount: 12, normalizedWeightGrams: null, displayUnit: "ขวด" },
  ]);
  assert.equal(groups[0].displayTh, "อื่น ๆ 12 ขวด");
});

test("E: Map popup displayTh matches Case Workspace canonical COUNT display", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "QA-MAP-001-MIRROR",
      seizedItems: [{ drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 5000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null }],
    })
  );
  const result = await new DrugGeoIntelligenceService({ db }).getGeoResult({ page: 1, pageSize: 20 });
  const popupLine = result.markers[0].seizedItems[0].displayTh;
  const caseLine = caseWorkspaceCountDisplay("ยาบ้า", 5000, "เม็ด");
  assert.equal(popupLine, caseLine);
  assert.equal(popupLine, "ยาบ้า 5,000 เม็ด");
});

test("F: Map result-list uses the same displayTh as the marker popup", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "QA-MAP-UNIT-F",
      seizedItems: [{ drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 5000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null }],
    })
  );
  const result = await new DrugGeoIntelligenceService({ db }).getGeoResult({ page: 1, pageSize: 20 });
  const popupLine = result.markers[0].seizedItems[0].displayTh;
  const listLine = result.markers[0].seizedItems.map((g) => g.displayTh).join(" • ");
  const provinceLine = result.provinceBreakdown[0].topSeizedItems.map((g) => g.displayTh).join(" • ");
  assert.equal(listLine, popupLine);
  assert.equal(provinceLine, popupLine);
});

test("G: no generic รายการ fallback when a real unit exists", () => {
  const groups = groupSeizedItemFacts([
    { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", normalizedCount: 5000, normalizedWeightGrams: null, displayUnit: "เม็ด" },
  ]);
  assert.equal(groups[0].displayTh.includes("รายการ"), false);
  assert.match(groups[0].displayTh, /เม็ด/);
});

test("H: COUNT and MASS for the same drug category remain separate", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "QA-MAP-UNIT-H",
      seizedItems: [
        { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 5000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null },
        { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "MASS", drugType: "ยาบ้า", subtype: null, quantity: null, unit: null, weightGrams: 500, packageCount: null, notes: null },
      ],
    })
  );
  const result = await new DrugGeoIntelligenceService({ db }).getGeoResult({ page: 1, pageSize: 20 });
  assert.equal(result.markers[0].seizedItems.length, 2);
  const countGroup = result.markers[0].seizedItems.find((g) => g.measurementKind === "COUNT");
  const massGroup = result.markers[0].seizedItems.find((g) => g.measurementKind === "MASS");
  assert.equal(countGroup?.displayTh, "ยาบ้า 5,000 เม็ด");
  assert.equal(massGroup?.displayTh, "ยาบ้า 0.5 กก.");
});

test("I: no raw measurement enum is visible in displayTh", () => {
  const groups = groupSeizedItemFacts([
    { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", normalizedCount: 5000, normalizedWeightGrams: null, displayUnit: "เม็ด" },
    { drugCategory: "CRYSTAL_METHAMPHETAMINE", otherDrugCategoryLabel: null, measurementKind: "MASS", normalizedCount: null, normalizedWeightGrams: 2500 },
  ]);
  for (const g of groups) {
    assert.equal(g.displayTh.includes("COUNT"), false);
    assert.equal(g.displayTh.includes("MASS"), false);
    assert.equal(g.displayTh.includes("LIQUID"), false);
    assert.equal(g.displayTh.includes("PIECES"), false);
    assert.equal(g.displayTh.includes("WEIGHT"), false);
  }
  const view = resolveDrugSeizedItemAnalyticsView({
    drugCategory: "METHAMPHETAMINE_TABLET",
    otherDrugCategoryLabel: null,
    measurementKind: "COUNT",
    normalizedCount: 5000,
    normalizedWeightGrams: null,
    displayUnit: "เม็ด",
  });
  assert.equal(formatSeizedItemDisplayTh({ ...view, displayUnit: view.displayUnit }), "ยาบ้า 5,000 เม็ด");
});
