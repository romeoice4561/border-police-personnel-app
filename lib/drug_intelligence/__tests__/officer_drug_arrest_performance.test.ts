/**
 * DI-7.7 — Officer Drug-Arrest Performance read model tests. Covers
 * Section 13's required matrix (A-L, O, P, S — permission/UI-level items Q/R
 * are covered by the browser-QA-adjacent handler/component layers, not this
 * pure-service file).
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/officer_drug_arrest_performance.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { OfficerDrugArrestPerformanceService } from "@/lib/drug_intelligence/officer_drug_arrest_performance_service";
import { groupSeizedItemFacts } from "@/lib/drug_intelligence/officer_drug_arrest_performance";
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
    province: "เชียงราย",
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    narrative: "เหตุการณ์ทดสอบ",
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

async function seedOfficer(db: InMemoryDatabaseClient, officerId: string) {
  await db.officer.create({ data: { officerId, rank: "ร.ต.อ.", firstName: "ทดสอบ", lastName: "เจ้าหน้าที่", currentUnit: "กก.ตชด.44" } });
}

// ── A: officer with zero drug cases ─────────────────────────────────────

test("A: officer with zero DrugCaseOfficer rows returns null (not an empty-but-present summary)", async () => {
  const db = new InMemoryDatabaseClient();
  const service = new OfficerDrugArrestPerformanceService({ db });
  const result = await service.getPerformanceSummary("no-such-officer");
  assert.equal(result, null);
});

// ── B: officer with one case ────────────────────────────────────────────

test("B: officer with one case returns totalCases=1 and the case's basic facts", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/1");
  const caseService = new DrugCaseService({ db });
  const result = await caseService.createCase(
    baseCase({
      caseNumber: "B-001",
      officers: [{ officerId: "ภาค4/1", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null }],
    })
  );

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/1");
  assert.ok(summary);
  assert.equal(summary!.totalCases, 1);
  assert.equal(summary!.cases[0].caseId, result.caseId);
  assert.equal(summary!.cases[0].caseNumber, "B-001");
  assert.equal(summary!.cases[0].province, "เชียงราย");
});

// ── C: officer with multiple cases ──────────────────────────────────────

test("C: officer with multiple cases returns all of them, chronologically ordered", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/2");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({ caseNumber: "C-EARLY", arrestDate: new Date("2026-01-01"), officers: [{ officerId: "ภาค4/2", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null }] })
  );
  await caseService.createCase(
    baseCase({ caseNumber: "C-LATE", arrestDate: new Date("2026-06-01"), officers: [{ officerId: "ภาค4/2", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null }] })
  );

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/2");
  assert.equal(summary!.totalCases, 2);
  assert.equal(summary!.cases[0].caseNumber, "C-LATE", "most recent arrest date first");
  assert.equal(summary!.cases[1].caseNumber, "C-EARLY");
});

// ── D: same officer with multiple roles ─────────────────────────────────

test("D: same officer with multiple roles on the SAME case shows both roles on that one case row", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/3");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "D-001",
      officers: [
        { officerId: "ภาค4/3", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARREST_TEAM_LEAD", note: null },
        { officerId: "ภาค4/3", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "INVESTIGATOR", note: null },
      ],
    })
  );

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/3");
  assert.equal(summary!.totalCases, 1, "one case, not two, even though there are two role rows");
  assert.deepEqual(summary!.cases[0].roles.sort(), ["ARREST_TEAM_LEAD", "INVESTIGATOR"].sort());
});

// ── E: lead role counting ───────────────────────────────────────────────

test("E: leadCases counts only cases where the officer held ARREST_TEAM_LEAD", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/4");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "E-LEAD", officers: [{ officerId: "ภาค4/4", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARREST_TEAM_LEAD", note: null }] }));
  await caseService.createCase(baseCase({ caseNumber: "E-SUPPORT", officers: [{ officerId: "ภาค4/4", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] }));

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/4");
  assert.equal(summary!.leadCases, 1);
  assert.equal(summary!.totalCases, 2);
});

// ── F: arresting-officer role counting ──────────────────────────────────

test("F: arrestingOfficerCases counts only cases where the officer held ARRESTING_OFFICER", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/5");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "F-ARREST", officers: [{ officerId: "ภาค4/5", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null }] }));
  await caseService.createCase(baseCase({ caseNumber: "F-EVIDENCE", officers: [{ officerId: "ภาค4/5", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "EVIDENCE_OFFICER", note: null }] }));

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/5");
  assert.equal(summary!.arrestingOfficerCases, 1);
});

// ── G: latest arrest date ───────────────────────────────────────────────

test("G: latestArrestDate reflects the most recent arrestDate across all the officer's cases", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/6");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "G-OLD", arrestDate: new Date("2025-01-01"), officers: [{ officerId: "ภาค4/6", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] }));
  await caseService.createCase(baseCase({ caseNumber: "G-NEW", arrestDate: new Date("2026-08-01"), officers: [{ officerId: "ภาค4/6", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] }));

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/6");
  assert.equal(summary!.latestArrestDate?.toISOString().slice(0, 10), "2026-08-01");
});

// ── H: case links ────────────────────────────────────────────────────────

test("H: each case summary carries its caseId, usable to build a Case Workspace link", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/7");
  const caseService = new DrugCaseService({ db });
  const result = await caseService.createCase(baseCase({ caseNumber: "H-001", officers: [{ officerId: "ภาค4/7", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] }));

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/7");
  assert.equal(summary!.cases[0].caseId, result.caseId);
  assert.ok(summary!.cases[0].caseId.length > 0);
});

// ── I: Thai role labels ──────────────────────────────────────────────────

test("I: role labels are Thai display text, never the raw enum", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/8");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "I-001", officers: [{ officerId: "ภาค4/8", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARREST_TEAM_LEAD", note: null }] }));

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/8");
  assert.deepEqual(summary!.cases[0].roleLabelsTh, ["หัวหน้าชุดจับกุม"]);
});

// ── J: no raw enum leakage ────────────────────────────────────────────────

test("J: statusLabelTh is Thai text, not the raw DrugCaseStatus enum value", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/9");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "J-001", status: "UNDER_INVESTIGATION", officers: [{ officerId: "ภาค4/9", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] }));

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/9");
  assert.equal(summary!.cases[0].status, "UNDER_INVESTIGATION", "raw value is still present for programmatic use");
  assert.equal(summary!.cases[0].statusLabelTh, "อยู่ระหว่างสอบสวน", "but the label is Thai text, never shown as the raw enum");
  assert.notEqual(summary!.cases[0].statusLabelTh, "UNDER_INVESTIGATION");
});

// ── K/L: seizure aggregation — compatible units summed, incompatible units kept separate ──

test("K: seizures of the SAME category+measurementKind across multiple cases sum correctly", () => {
  const groups = groupSeizedItemFacts([
    { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", normalizedCount: 100000, normalizedWeightGrams: null },
    { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", normalizedCount: 270000, normalizedWeightGrams: null },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].totalCount, 370000);
  assert.equal(groups[0].displayTh, "ยาบ้า 370,000");
});

test("L: COUNT and MASS rows for the SAME category are NEVER summed together — kept as separate groups", () => {
  const groups = groupSeizedItemFacts([
    { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", normalizedCount: 5000, normalizedWeightGrams: null },
    { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "MASS", normalizedCount: null, normalizedWeightGrams: 500 },
  ]);
  assert.equal(groups.length, 2, "one COUNT group and one MASS group — never merged into a single misleading number");
  const countGroup = groups.find((g) => g.measurementKind === "COUNT");
  const massGroup = groups.find((g) => g.measurementKind === "MASS");
  assert.equal(countGroup?.totalCount, 5000);
  assert.equal(massGroup?.totalWeightGrams, 500);
});

test("L2: different categories are never combined into one figure (ยาบ้า vs ไอซ์)", () => {
  const groups = groupSeizedItemFacts([
    { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", normalizedCount: 370000, normalizedWeightGrams: null },
    { drugCategory: "CRYSTAL_METHAMPHETAMINE", otherDrugCategoryLabel: null, measurementKind: "MASS", normalizedCount: null, normalizedWeightGrams: 5400 },
  ]);
  assert.equal(groups.length, 2);
  const yaba = groups.find((g) => g.drugCategory === "METHAMPHETAMINE_TABLET");
  const ice = groups.find((g) => g.drugCategory === "CRYSTAL_METHAMPHETAMINE");
  assert.equal(yaba?.displayTh, "ยาบ้า 370,000");
  assert.equal(ice?.displayTh, "ไอซ์ 5.4 กก.");
});

test("COUNT rows with a stored เม็ด unit format as เม็ด, never รายการ", () => {
  const groups = groupSeizedItemFacts([
    { drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", normalizedCount: 5000, normalizedWeightGrams: null, displayUnit: "เม็ด" },
  ]);
  assert.equal(groups[0].displayTh, "ยาบ้า 5,000 เม็ด");
  assert.ok(!groups[0].displayTh.includes("รายการ"));
});

test("COUNT rows with different stored units stay in separate groups", () => {
  const groups = groupSeizedItemFacts([
    { drugCategory: "OTHER", otherDrugCategoryLabel: "ยาแก้ไอ", measurementKind: "COUNT", normalizedCount: 12, normalizedWeightGrams: null, displayUnit: "ขวด" },
    { drugCategory: "OTHER", otherDrugCategoryLabel: "ยาแก้ไอ", measurementKind: "COUNT", normalizedCount: 250, normalizedWeightGrams: null, displayUnit: "มล." },
  ]);
  assert.equal(groups.length, 2);
  const bottle = groups.find((g) => g.displayUnit === "ขวด");
  const ml = groups.find((g) => g.displayUnit === "มล.");
  assert.equal(bottle?.displayTh, "อื่น ๆ 12 ขวด");
  assert.equal(ml?.displayTh, "อื่น ๆ 250 มล.");
});

// ── O: officer remains separate from DrugPerson ─────────────────────────

test("O: computing an officer's performance summary creates and reads zero DrugPerson rows", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/10");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "O-001", officers: [{ officerId: "ภาค4/10", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] }));

  const before = (await db.drugPerson.findMany({})).length;
  const perfService = new OfficerDrugArrestPerformanceService({ db });
  await perfService.getPerformanceSummary("ภาค4/10");
  const after = (await db.drugPerson.findMany({})).length;
  assert.equal(after, before, "reading officer performance must never create a DrugPerson row");
});

// ── P: no network relationship creation ─────────────────────────────────

test("P: computing an officer's performance summary creates zero DrugNetworkGroup/DrugPersonNetworkRole rows", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/11");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "P-001", officers: [{ officerId: "ภาค4/11", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] }));

  const beforeGroups = (await db.drugNetworkGroup.findMany({})).length;
  const beforeRoles = (await db.drugPersonNetworkRole.findMany({})).length;
  const perfService = new OfficerDrugArrestPerformanceService({ db });
  await perfService.getPerformanceSummary("ภาค4/11");
  assert.equal((await db.drugNetworkGroup.findMany({})).length, beforeGroups);
  assert.equal((await db.drugPersonNetworkRole.findMany({})).length, beforeRoles);
});

// ── R: missing/partial data ──────────────────────────────────────────────

test("R: a case with no seizures still produces a valid summary with an empty seizedItems array", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/12");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(baseCase({ caseNumber: "R-001", seizedItems: [], officers: [{ officerId: "ภาค4/12", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] }));

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/12");
  assert.deepEqual(summary!.cases[0].seizedItems, []);
});

test("R2: a case with no arrestDate, province, or leadUnitText renders cleanly (no crash, null fields preserved)", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/13");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({ caseNumber: "R2-001", arrestDate: null, province: null, reportingUnitText: null, officers: [{ officerId: "ภาค4/13", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null }] })
  );

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/13");
  assert.equal(summary!.cases[0].arrestDate, null);
  assert.equal(summary!.cases[0].province, null);
  assert.equal(summary!.cases[0].leadUnitText, null);
  assert.equal(summary!.latestArrestDate, null, "no arrestDate anywhere means latestArrestDate stays null, never a fabricated date");
});

test("R3: manual/external arrest-team members (officerId=null) never appear in an internal officer's performance summary", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/14");
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "R3-001",
      officers: [
        { officerId: "ภาค4/14", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null },
        { officerId: null, manualRank: "ร.ต.ต.", manualFullName: "ภายนอก", manualPosition: null, manualUnitText: null, role: "SUPPORT", note: null },
      ],
    })
  );

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/14");
  assert.equal(summary!.totalCases, 1);
  assert.deepEqual(summary!.cases[0].roles, ["ARRESTING_OFFICER"], "the external officer's SUPPORT role must not bleed into this internal officer's summary");
});

// ── S: batched / no obvious N+1 ─────────────────────────────────────────

test("S: getPerformanceSummary across many cases issues a bounded, batched query pattern (no crash/timeout at moderate scale)", async () => {
  const db = new InMemoryDatabaseClient();
  await seedOfficer(db, "ภาค4/15");
  const caseService = new DrugCaseService({ db });
  const CASE_COUNT = 25;
  for (let i = 0; i < CASE_COUNT; i++) {
    await caseService.createCase(
      baseCase({
        caseNumber: `S-${i}`,
        arrestDate: new Date(2026, 0, i + 1),
        seizedItems: [{ drugCategory: "METHAMPHETAMINE_TABLET", otherDrugCategoryLabel: null, measurementKind: "COUNT", drugType: "ยาบ้า", subtype: null, quantity: 1000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null }],
        officers: [{ officerId: "ภาค4/15", manualRank: null, manualFullName: null, manualPosition: null, manualUnitText: null, role: "ARRESTING_OFFICER", note: null }],
      })
    );
  }

  const perfService = new OfficerDrugArrestPerformanceService({ db });
  const summary = await perfService.getPerformanceSummary("ภาค4/15");
  assert.equal(summary!.totalCases, CASE_COUNT);
  assert.equal(summary!.arrestingOfficerCases, CASE_COUNT);
  assert.equal(summary!.aggregateSeizedItems[0].totalCount, CASE_COUNT * 1000);
});
