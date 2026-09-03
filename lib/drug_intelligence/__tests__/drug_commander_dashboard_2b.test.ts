/**
 * Tests for Commander Intelligence Dashboard (Phase 2B).
 *
 * Tests:
 * - Filter resolver: default FY, custom dates, from/to override FY, org filter, province
 * - Service: case count, arrested person count, seizure aggregation (COUNT/MASS separate),
 *   trend buckets, area ranking, signals
 *
 * Uses InMemoryDatabaseClient for the service tests (same pattern as
 * drug_case_service.test.ts and drug_intelligence_alert_service.test.ts).
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_commander_dashboard_2b.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugCommanderDashboardService } from "@/lib/drug_intelligence/drug_commander_dashboard_service";
import { resolveCommanderFilter, resolveCommanderDashboardScope, buildCommanderCaseWhere } from "@/lib/drug_intelligence/drug_commander_filter";
import {
  commanderCasesHref,
  commanderPersonsHref,
  commanderMapHref,
  commanderMonthCasesHref,
  commanderAlertsHref,
  commanderDuplicatesHref,
  commanderReturnPath,
  commanderUnitCasesHref,
} from "@/lib/drug_intelligence/drug_commander_drilldown";
import { COMMANDER_FY_MONTH_LABELS_TH, commanderMonthLabel } from "@/lib/drug_intelligence/drug_commander_trend_labels";
import { getSafeReturnTo, isSafeInternalReturnPath, withReturnTo } from "@/lib/ui/return_context";
import { isCommanderDashboardReturnTo, returnToBackLabelKey } from "@/lib/ui/return_to_back_label";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

// ── Helpers ───────────────────────────────────────────────────────────────

function params(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "CMD-TEST-001",
    title: "คดีทดสอบ Dashboard",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: "10:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: null,
    leadHeadquartersId: null,
    leadRegionId: null,
    leadBattalionId: null,
    leadCompanyId: null,
    leadUnitText: null,
    province: "เชียงราย",
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    participatingUnits: [],
    officers: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

function newSuspect(name: string): DrugCasePersonInput {
  return {
    newPerson: {
      primaryFullName: name,
      nationality: null,
      dateOfBirth: null,
      notes: null,
      identifiers: [],
    },
    role: "ARRESTED_PERSON",
    linkedOfficerId: null,
    notes: null,
    phones: [],
    sims: [],
    devices: [],
    vehicles: [],
  };
}

function newAccused(name: string): DrugCasePersonInput {
  return { ...newSuspect(name), role: "ACCUSED" };
}

function newWitness(name: string): DrugCasePersonInput {
  return { ...newSuspect(name), role: "WITNESS" };
}

// ── Filter Resolver Tests ─────────────────────────────────────────────────

test("resolveCommanderFilter: defaults to current fiscal year when no params given", () => {
  const filter = resolveCommanderFilter(params({}));
  assert.ok(filter.arrestDateFrom instanceof Date, "start is a Date");
  assert.ok(filter.arrestDateTo instanceof Date, "end is a Date");
  assert.ok(filter.fiscalYear !== undefined, "fiscalYear is set");
  assert.ok(filter.fiscalYearBe !== undefined, "fiscalYearBe is set");
  assert.ok(filter.displayFiscalYearTh?.startsWith("ปีงบประมาณ"), "displayFiscalYearTh has prefix");
  // FY runs Oct→Sep: start day must be Oct 1 and end day Sep 30
  assert.equal(filter.arrestDateFrom.getUTCMonth() + 1, 10, "FY starts in October");
  assert.equal(filter.arrestDateTo.getUTCMonth() + 1, 9, "FY ends in September");
});

test("resolveCommanderFilter: fy param (BE year 2569) expands to FY 2026 Gregorian dates", () => {
  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  // BE 2569 = Gregorian FY 2026 (Oct 2025 → Sep 2026)
  assert.equal(filter.fiscalYear, 2026);
  assert.equal(filter.fiscalYearBe, 2569);
  assert.equal(filter.arrestDateFrom.getUTCFullYear(), 2025, "starts in 2025 (Oct)");
  assert.equal(filter.arrestDateFrom.getUTCMonth() + 1, 10, "starts in October");
  assert.equal(filter.arrestDateTo.getUTCFullYear(), 2026, "ends in 2026 (Sep)");
  assert.equal(filter.arrestDateTo.getUTCMonth() + 1, 9, "ends in September");
  assert.equal(filter.displayFiscalYearTh, "ปีงบประมาณ 2569");
});

test("resolveCommanderFilter: from+to override FY (no FY metadata)", () => {
  const filter = resolveCommanderFilter(params({ from: "2026-01-01", to: "2026-03-31" }));
  assert.equal(filter.arrestDateFrom.getUTCFullYear(), 2026);
  assert.equal(filter.arrestDateFrom.getUTCMonth() + 1, 1);
  assert.equal(filter.arrestDateTo.getUTCMonth() + 1, 3);
  // No FY metadata when explicit dates provided
  assert.equal(filter.fiscalYear, undefined);
});

test("resolveCommanderFilter: org filters are parsed correctly", () => {
  const filter = resolveCommanderFilter(
    params({ hqId: "1", regionId: "2", battalionId: "3", companyId: "4" })
  );
  assert.equal(filter.reportingHeadquartersId, 1);
  assert.equal(filter.reportingRegionId, 2);
  assert.equal(filter.reportingBattalionId, 3);
  assert.equal(filter.reportingCompanyId, 4);
});

test("resolveCommanderFilter: province param is set", () => {
  const filter = resolveCommanderFilter(params({ province: "เชียงราย" }));
  assert.equal(filter.province, "เชียงราย");
});

test("resolveCommanderFilter: invalid fy falls back to current FY", () => {
  const filter = resolveCommanderFilter(params({ fy: "not-a-number" }));
  assert.ok(filter.fiscalYear !== undefined, "falls back to current FY");
});

test("buildCommanderCaseWhere: includes arrestDate range", () => {
  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  const where = buildCommanderCaseWhere(filter);
  assert.ok(where.arrestDate, "arrestDate present");
  const ar = where.arrestDate as { gte: Date; lte: Date };
  assert.ok(ar.gte instanceof Date);
  assert.ok(ar.lte instanceof Date);
});

test("buildCommanderCaseWhere: includes org filters when set", () => {
  const filter = resolveCommanderFilter(params({ battalionId: "5", province: "กรุงเทพ" }));
  const where = buildCommanderCaseWhere(filter);
  assert.equal(where.battalionId, 5);
  assert.equal(where.province, "กรุงเทพ");
  assert.equal(where.regionId, undefined);
});

// ── Service Tests ─────────────────────────────────────────────────────────

test("service.getOverview: case count matches created cases in FY", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);

  // Create 3 cases within FY 2026 (Oct 2025 – Sep 2026)
  await caseService.createCase(baseCase({ caseNumber: "CMD-001", arrestDate: new Date("2026-01-10") }));
  await caseService.createCase(baseCase({ caseNumber: "CMD-002", arrestDate: new Date("2026-03-15") }));
  await caseService.createCase(baseCase({ caseNumber: "CMD-003", arrestDate: new Date("2025-11-20") })); // Oct 2025 → in FY 2026

  // 1 case outside FY 2026 (Oct 2024 – Sep 2025)
  await caseService.createCase(baseCase({ caseNumber: "CMD-OLD", arrestDate: new Date("2025-05-01") })); // FY 2025

  const filter = resolveCommanderFilter(params({ fy: "2569" })); // FY 2026
  const overview = await commanderService.getOverview(filter);
  assert.equal(overview.caseCount, 3, "only 3 cases in FY 2026");
});

test("service.getOverview: arrested person count — only ARRESTED_PERSON + ACCUSED roles", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);

  await caseService.createCase(
    baseCase({
      caseNumber: "CMD-PERSONS",
      arrestDate: new Date("2026-02-01"),
      persons: [
        newSuspect("บุคคล ก"),   // ARRESTED_PERSON ✓
        newAccused("บุคคล ข"),   // ACCUSED ✓
        newWitness("บุคคล ค"),  // WITNESS ✗
      ],
    })
  );

  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  const overview = await commanderService.getOverview(filter);
  assert.equal(overview.arrestedPersonCount, 2, "only ARRESTED_PERSON + ACCUSED count");
});

test("service.getOverview: same person in two cases counted once", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);

  // Create person in case 1
  const case1 = await caseService.createCase(
    baseCase({ caseNumber: "CMD-P1", arrestDate: new Date("2026-01-05"), persons: [newSuspect("บุคคล ซ้ำ")] })
  );

  // Get person id from DB to reuse
  const personRows = await db.drugCasePerson.findMany({ where: { caseId: case1.caseId } });
  const personId = (personRows[0] as unknown as { personId: string }).personId;

  // Reuse same person in case 2
  await caseService.createCase(
    baseCase({
      caseNumber: "CMD-P2",
      arrestDate: new Date("2026-02-10"),
      persons: [{ existingPersonId: personId, role: "ARRESTED_PERSON", linkedOfficerId: null, notes: null, phones: [], sims: [], devices: [], vehicles: [] }],
    })
  );

  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  const overview = await commanderService.getOverview(filter);
  assert.equal(overview.arrestedPersonCount, 1, "same person counted once (distinct personId)");
  assert.equal(overview.caseCount, 2, "two cases");
});

test("service.getSeizures: COUNT and MASS kept separate — never mixed", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);

  await caseService.createCase(
    baseCase({
      caseNumber: "SEIZURE-001",
      arrestDate: new Date("2026-01-20"),
      seizedItems: [
        { drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 1000, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
        { drugCategory: "CRYSTAL_METHAMPHETAMINE", measurementKind: "MASS", drugType: "ไอซ์", quantity: null, unit: null, weightGrams: 500, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
      ],
    })
  );

  await caseService.createCase(
    baseCase({
      caseNumber: "SEIZURE-002",
      arrestDate: new Date("2026-02-15"),
      seizedItems: [
        { drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 2500, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
        { drugCategory: "CRYSTAL_METHAMPHETAMINE", measurementKind: "MASS", drugType: "ไอซ์", quantity: null, unit: null, weightGrams: 1500, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
      ],
    })
  );

  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  const seizures = await commanderService.getSeizures(filter);

  // Find meth tablet (COUNT) item
  const methItem = seizures.items.find(
    (i) => i.drugCategory === "METHAMPHETAMINE_TABLET" && i.measurementKind === "COUNT"
  );
  assert.ok(methItem, "methamphetamine COUNT item exists");
  assert.equal(methItem?.totalQuantity, 3500, "COUNT quantities summed: 1000+2500");
  assert.equal(methItem?.totalWeightGrams, null, "COUNT row has no weight");
  assert.equal(methItem?.totalWeightKg, null, "COUNT row has no kg");

  // Find crystal meth (MASS) item
  const iceItem = seizures.items.find(
    (i) => i.drugCategory === "CRYSTAL_METHAMPHETAMINE" && i.measurementKind === "MASS"
  );
  assert.ok(iceItem, "crystal meth MASS item exists");
  assert.equal(iceItem?.totalWeightGrams, 2000, "MASS weights summed: 500+1500");
  assert.ok(Math.abs((iceItem?.totalWeightKg ?? 0) - 2) < 0.001, "2000g = 2.0 kg");
  assert.equal(iceItem?.totalQuantity, null, "MASS row has no quantity");

  // Verify they are NOT combined
  const combined = seizures.items.find(
    (i) => i.drugCategory === "METHAMPHETAMINE_TABLET" && i.measurementKind === "MASS"
  );
  assert.equal(combined, undefined, "no METHAMPHETAMINE_TABLET MASS item (would violate aggregation rule)");
});

test("service.getTrend: buckets are sorted by monthKey", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);

  await caseService.createCase(baseCase({ caseNumber: "T1", arrestDate: new Date("2026-03-05") }));
  await caseService.createCase(baseCase({ caseNumber: "T2", arrestDate: new Date("2026-01-10") }));
  await caseService.createCase(baseCase({ caseNumber: "T3", arrestDate: new Date("2026-03-20") }));
  await caseService.createCase(baseCase({ caseNumber: "T4", arrestDate: new Date("2025-11-01") }));

  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  const trend = await commanderService.getTrend(filter);

  // Should have buckets for Nov 2025, Jan 2026, Mar 2026
  assert.ok(trend.buckets.length >= 3, "at least 3 monthly buckets");
  assert.equal(trend.totalCases, 4, "4 total cases");

  // Verify chronological order
  for (let i = 1; i < trend.buckets.length; i++) {
    assert.ok(
      trend.buckets[i].monthKey >= trend.buckets[i - 1].monthKey,
      `bucket ${i} is after bucket ${i - 1}`
    );
  }

  const marBucket = trend.buckets.find((b) => b.monthKey === "2026-03");
  assert.ok(marBucket, "March 2026 bucket exists");
  assert.equal(marBucket?.caseCount, 2, "2 cases in March 2026");
});

test("service.getAreas: top provinces sorted by case count desc", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);

  // 3 cases in เชียงราย, 2 in เชียงใหม่, 1 in แม่ฮ่องสอน
  for (let i = 0; i < 3; i++) {
    await caseService.createCase(baseCase({ caseNumber: `A-CR-${i}`, arrestDate: new Date("2026-01-10"), province: "เชียงราย" }));
  }
  for (let i = 0; i < 2; i++) {
    await caseService.createCase(baseCase({ caseNumber: `A-CM-${i}`, arrestDate: new Date("2026-02-15"), province: "เชียงใหม่" }));
  }
  await caseService.createCase(baseCase({ caseNumber: "A-MH", arrestDate: new Date("2026-03-01"), province: "แม่ฮ่องสอน" }));

  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  const areas = await commanderService.getAreas(filter);

  assert.ok(areas.rows.length === 3, "3 provinces");
  assert.equal(areas.rows[0].province, "เชียงราย", "top province is เชียงราย");
  assert.equal(areas.rows[0].caseCount, 3);
  assert.equal(areas.rows[1].province, "เชียงใหม่");
  assert.equal(areas.rows[1].caseCount, 2);
  assert.equal(areas.rows[2].province, "แม่ฮ่องสอน");
  assert.equal(areas.rows[2].caseCount, 1);
});

test("service.getAreas: excludes cases with null province", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);

  await caseService.createCase(baseCase({ caseNumber: "NULL-PROVINCE", arrestDate: new Date("2026-02-01"), province: null }));
  await caseService.createCase(baseCase({ caseNumber: "HAS-PROVINCE", arrestDate: new Date("2026-02-02"), province: "นครปฐม" }));

  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  const areas = await commanderService.getAreas(filter);

  const nullRow = areas.rows.find((r) => r.province === "");
  assert.equal(nullRow, undefined, "null province not included");
  assert.equal(areas.rows.length, 1, "only 1 province row");
});

test("service.getSignals: returns 5 signal type counts", async () => {
  const db = new InMemoryDatabaseClient();
  const commanderService = new DrugCommanderDashboardService(db);

  // Create some alerts manually
  await db.drugIntelligenceAlert.create({
    data: {
      id: "alert-1",
      alertType: "REPEAT_PERSON",
      status: "NEW",
      severity: "HIGH",
      entityType: "PERSON",
      entityId: "person-1",
      title: "Test alert",
      explanation: "test",
      currentCaseId: null,
      priorCaseIds: [],
      relatedPersonIds: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      occurrenceCount: 3,
      dedupeKey: "test-key-1",
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      dismissReason: null,
      createdAt: new Date(),
    },
  });

  await db.drugIntelligenceAlert.create({
    data: {
      id: "alert-2",
      alertType: "REPEAT_PHONE",
      status: "NEW",
      severity: "NOTICE",
      entityType: "PHONE",
      entityId: "phone-1",
      title: "Phone alert",
      explanation: "test",
      currentCaseId: null,
      priorCaseIds: [],
      relatedPersonIds: null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      occurrenceCount: 2,
      dedupeKey: "test-key-2",
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      dismissReason: null,
      createdAt: new Date(),
    },
  });

  const signals = await commanderService.getSignals();

  assert.equal(signals.signalCounts.length, 5, "5 signal type counts");
  const personSignal = signals.signalCounts.find((s) => s.alertType === "REPEAT_PERSON");
  assert.ok(personSignal, "REPEAT_PERSON count present");
  assert.equal(personSignal?.count, 1);

  const phoneSignal = signals.signalCounts.find((s) => s.alertType === "REPEAT_PHONE");
  assert.ok(phoneSignal, "REPEAT_PHONE count present");
  assert.equal(phoneSignal?.count, 1);

  // Verify REPEAT_SIM, REPEAT_DEVICE, REPEAT_VEHICLE are 0
  const simSignal = signals.signalCounts.find((s) => s.alertType === "REPEAT_SIM");
  assert.equal(simSignal?.count, 0);

  assert.ok(signals.topSignals.length <= 10, "server hard cap is 10 top signals");
  assert.equal(signals.totalNewAlerts, 2, "totalNewAlerts is sum of repeat counts");
});

test("resolveCommanderFilter: from/to override fy even when fy is also present", () => {
  const filter = resolveCommanderFilter(params({ fy: "2569", from: "2026-02-01", to: "2026-02-28" }));
  assert.equal(filter.arrestDateFrom.toISOString().slice(0, 10), "2026-02-01");
  assert.equal(filter.arrestDateTo.toISOString().slice(0, 10), "2026-02-28");
  assert.equal(filter.fiscalYear, undefined);
});

test("resolveCommanderFilter: invalid dates fall back to current FY", () => {
  const filter = resolveCommanderFilter(params({ from: "not-a-date", to: "also-bad" }));
  assert.ok(filter.fiscalYear !== undefined);
  assert.equal(filter.arrestDateFrom.getUTCMonth() + 1, 10);
});

test("resolveCommanderFilter: invalid unit ids are ignored", () => {
  const filter = resolveCommanderFilter(params({ battalionId: "abc", hqId: "-3" }));
  assert.equal(filter.reportingBattalionId, undefined);
  assert.equal(filter.reportingHeadquartersId, undefined);
});

test("resolveCommanderFilter: unitType+unitId maps to reporting battalion", () => {
  const filter = resolveCommanderFilter(params({ unitType: "BATTALION", unitId: "41" }));
  assert.equal(filter.reportingBattalionId, 41);
});

test("resolveCommanderDashboardScope: returns requested filter unchanged (global drug.read)", () => {
  const requested = resolveCommanderFilter(params({ fy: "2569", province: "เชียงราย" }));
  const scoped = resolveCommanderDashboardScope({ id: "mock:admin" }, requested);
  assert.equal(scoped.province, requested.province);
  assert.equal(scoped.fiscalYear, requested.fiscalYear);
});

test("buildCommanderCaseWhere: always includes a date bound", () => {
  const where = buildCommanderCaseWhere(resolveCommanderFilter(params({})));
  const arrestDate = where.arrestDate as { gte: Date; lte: Date };
  assert.ok(arrestDate.gte < arrestDate.lte);
});

test("service.getTrend: fills every month in the FY window including zeros", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);
  await caseService.createCase(baseCase({ caseNumber: "T-FILL", arrestDate: new Date("2026-01-10") }));
  const trend = await commanderService.getTrend(resolveCommanderFilter(params({ fy: "2569" })));
  assert.equal(trend.buckets.length, 12, "Oct–Sep is 12 months");
  assert.equal(trend.buckets[0].monthKey, "2025-10");
  assert.equal(trend.buckets[11].monthKey, "2026-09");
  assert.equal(trend.buckets.find((b) => b.monthKey === "2026-01")?.caseCount, 1);
  assert.equal(trend.buckets.find((b) => b.monthKey === "2025-10")?.caseCount, 0);
});

test("service.getAreas: ties are deterministic by province name", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);
  await caseService.createCase(baseCase({ caseNumber: "TIE-B", arrestDate: new Date("2026-01-10"), province: "บุรีรัมย์" }));
  await caseService.createCase(baseCase({ caseNumber: "TIE-A", arrestDate: new Date("2026-01-11"), province: "กระบี่" }));
  const areas = await commanderService.getAreas(resolveCommanderFilter(params({ fy: "2569" })));
  assert.equal(areas.rows.length, 2);
  assert.equal(areas.rows[0].caseCount, 1);
  assert.equal(areas.rows[0].province, "กระบี่");
});

test("service.getAreas: hard cap is 10", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);
  for (let i = 0; i < 12; i++) {
    await caseService.createCase(baseCase({
      caseNumber: `CAP-${i}`,
      arrestDate: new Date("2026-01-10"),
      province: `จังหวัด-${String(i).padStart(2, "0")}`,
    }));
  }
  const areas = await commanderService.getAreas(resolveCommanderFilter(params({ fy: "2569" })));
  assert.equal(areas.rows.length, 10);
});

test("service.getUnits: reporting battalion grouping, no universal score, hard cap 20", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);
  for (let i = 1; i <= 22; i++) {
    await caseService.createCase(baseCase({
      caseNumber: `U-${i}`,
      arrestDate: new Date("2026-01-10"),
      battalionId: i,
      persons: [newSuspect(`ผู้ถูกจับ ${i}`)],
    }));
  }
  const units = await commanderService.getUnits(resolveCommanderFilter(params({ fy: "2569" })));
  assert.equal(units.groupBy, "battalion");
  assert.equal(units.rows.length, 20);
  assert.ok(units.rows.every((row) => row.unitId !== null));
  assert.ok(!("score" in units.rows[0]));
});

test("service.getOverview: empty period is a legitimate zero, not an error", async () => {
  const db = new InMemoryDatabaseClient();
  const commanderService = new DrugCommanderDashboardService(db);
  const overview = await commanderService.getOverview(resolveCommanderFilter(params({ from: "2010-01-01", to: "2010-01-31" })));
  assert.equal(overview.caseCount, 0);
  assert.equal(overview.arrestedPersonCount, 0);
});

test("service.getSeizures: OTHER and null values stay isolated", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);
  await caseService.createCase(baseCase({
    caseNumber: "SEIZURE-OTHER",
    arrestDate: new Date("2026-01-20"),
    seizedItems: [
      { drugCategory: "OTHER", measurementKind: "COUNT", drugType: "อื่น", quantity: null, unit: null, weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: "ไม่ทราบ", subtype: null },
      { drugCategory: "HEROIN", measurementKind: "MASS", drugType: "เฮโรอีน", quantity: null, unit: null, weightGrams: 1000, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
    ],
  }));
  const seizures = await commanderService.getSeizures(resolveCommanderFilter(params({ fy: "2569" })));
  const other = seizures.items.find((i) => i.drugCategory === "OTHER");
  const heroin = seizures.items.find((i) => i.drugCategory === "HEROIN");
  assert.ok(other);
  assert.equal(other?.measurementKind, "COUNT");
  assert.equal(other?.totalQuantity, 0);
  assert.equal(other?.totalWeightKg, null);
  assert.ok(heroin);
  assert.equal(heroin?.totalWeightKg, 1);
  assert.equal(heroin?.totalQuantity, null);
});

test("drill-down: cases KPI preserves FY and battalion", () => {
  const filter = resolveCommanderFilter(params({ fy: "2569", battalionId: "41", province: "เชียงราย" }));
  const cases = commanderCasesHref(filter);
  assert.match(cases, /arrestDateFrom=2025-10-01/);
  assert.match(cases, /arrestDateTo=2026-09-30/);
  assert.match(cases, /battalionId=41/);
  assert.match(cases, /province=/);
  const persons = commanderPersonsHref(filter);
  assert.match(persons, /dateFrom=2025-10-01/);
  assert.match(persons, /caseRoles=ARRESTED_PERSON%2CACCUSED|caseRoles=ARRESTED_PERSON,ACCUSED/);
  assert.match(persons, /battalionId=41/);
  const map = commanderMapHref(filter, { drugCategory: "METHAMPHETAMINE_TABLET" });
  assert.match(map, /dateFrom=2025-10-01/);
  assert.match(map, /drugCategory=METHAMPHETAMINE_TABLET/);
  const month = commanderMonthCasesHref(filter, 2026, 1);
  assert.match(month, /arrestDateFrom=2026-01-01/);
  assert.match(month, /arrestDateTo=2026-01-31/);
  assert.match(month, /battalionId=41/);
  assert.match(month, /returnTo=/);
  assert.match(decodeURIComponent(month), /\/drug-intelligence\/command\?fy=2569/);
  assert.equal(commanderAlertsHref({ status: "NEW" }), "/drug-intelligence/alerts?status=NEW");
  assert.match(commanderAlertsHref({ status: "NEW" }, filter), /returnTo=/);
});

test("handler: unauthenticated overview is rejected", async () => {
  const { handleCommanderOverview } = await import("@/lib/drug_intelligence/drug_commander_api_handlers");
  const db = new InMemoryDatabaseClient();
  const service = new DrugCommanderDashboardService(db);
  const response = await handleCommanderOverview(service, params({}), null, new Request("http://localhost/api/drug-intelligence/command/overview"));
  assert.equal(response.status, 400);
});

test("handler: officer without drug.read is rejected", async () => {
  const { handleCommanderOverview } = await import("@/lib/drug_intelligence/drug_commander_api_handlers");
  const { SESSION_COOKIE_NAME } = await import("@/lib/auth/auth_config");
  const db = new InMemoryDatabaseClient();
  const service = new DrugCommanderDashboardService(db);
  const request = new Request("http://localhost/api/drug-intelligence/command/overview?actorId=mock:1101700123456", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=test-session` },
  });
  const response = await handleCommanderOverview(service, new URL(request.url).searchParams, "mock:1101700123456", request);
  assert.equal(response.status, 403);
});

test("handler: commander with drug.read can load overview", async () => {
  const { handleCommanderOverview } = await import("@/lib/drug_intelligence/drug_commander_api_handlers");
  const { SESSION_COOKIE_NAME } = await import("@/lib/auth/auth_config");
  const db = new InMemoryDatabaseClient();
  const service = new DrugCommanderDashboardService(db);
  const request = new Request("http://localhost/api/drug-intelligence/command/overview?actorId=mock:bpp414", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=test-session` },
  });
  const response = await handleCommanderOverview(service, new URL(request.url).searchParams, "mock:bpp414", request);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { caseCount: number; generatedAt: string } };
  assert.equal(typeof body.data.caseCount, "number");
  assert.ok(body.data.generatedAt);
});

test("trend labels: 12 Thai FY months Oct→Sep, no single-letter abbreviations", () => {
  assert.equal(COMMANDER_FY_MONTH_LABELS_TH.length, 12);
  assert.deepEqual([...COMMANDER_FY_MONTH_LABELS_TH], [
    "ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.",
  ]);
  for (const label of COMMANDER_FY_MONTH_LABELS_TH) {
    assert.ok(label.length >= 3);
    assert.ok(label.includes("."));
  }
  assert.equal(commanderMonthLabel(10, "th"), "ต.ค.");
  assert.equal(commanderMonthLabel(9, "th"), "ก.ย.");
});

test("trend chart: HTML labels, not stretched SVG text", () => {
  const src = readFileSync(join(process.cwd(), "components/drug_intelligence/drug_commander_trend_chart.tsx"), "utf8");
  assert.match(src, /data-testid="commander-trend-chart"/);
  assert.match(src, /text-\[12px\]/);
  assert.match(src, /text-foreground/);
  assert.doesNotMatch(src, /preserveAspectRatio="none"/);
  assert.doesNotMatch(src, /fontSize=\{5/);
  assert.match(src, /di\.command\.trendTooltip/);
  assert.match(src, /commanderMonthCasesHref/);
});

test("commanderReturnPath preserves FY, org, and province; no PII keys", () => {
  const filter = resolveCommanderFilter(params({ fy: "2568", hqId: "1", regionId: "4", battalionId: "16", province: "ชุมพร" }));
  const path = commanderReturnPath(filter);
  assert.equal(path.startsWith("/drug-intelligence/command"), true);
  assert.match(path, /fy=2568/);
  assert.match(path, /hqId=1/);
  assert.match(path, /regionId=4/);
  assert.match(path, /battalionId=16/);
  assert.match(path, /province=ชุมพร/);
  assert.doesNotMatch(path, /citizen|phone|imei|personId/i);
  assert.equal(isSafeInternalReturnPath(path), true);
});

test("commanderReturnPath uses from/to when custom dates override FY", () => {
  const filter = resolveCommanderFilter(params({ from: "2026-01-01", to: "2026-03-31" }));
  const path = commanderReturnPath(filter);
  assert.match(path, /from=2026-01-01/);
  assert.match(path, /to=2026-03-31/);
  assert.doesNotMatch(path, /[?&]fy=/);
});

test("safe commander returnTo accepted; external and javascript rejected", () => {
  const safe = "/drug-intelligence/command?fy=2569&province=ชุมพร";
  assert.equal(isSafeInternalReturnPath(safe), true);
  assert.equal(getSafeReturnTo(new URLSearchParams({ returnTo: safe })), safe);
  assert.equal(isSafeInternalReturnPath("https://evil.example/drug-intelligence/command"), false);
  assert.equal(isSafeInternalReturnPath("javascript:alert(1)"), false);
  assert.equal(withReturnTo("/drug-intelligence/cases", "https://evil.example"), "/drug-intelligence/cases");
});

test("Commander back label is used only for command returnTo", () => {
  assert.equal(returnToBackLabelKey("/drug-intelligence/command?fy=2569"), "di.command.backToDashboard");
  assert.equal(isCommanderDashboardReturnTo("/drug-intelligence/command?fy=2568"), true);
  assert.equal(isCommanderDashboardReturnTo("/drug-intelligence/cases"), false);
  assert.equal(returnToBackLabelKey("/drug-intelligence/search?mode=relationship"), "di.rel.backToSearchResults");
  assert.equal(returnToBackLabelKey("/drug-intelligence/map"), "di.map.actionBackToMap");
});

test("month drill-down keeps exact month dates and original Commander returnTo", () => {
  const filter = resolveCommanderFilter(params({ fy: "2569", province: "ชุมพร" }));
  const href = commanderMonthCasesHref(filter, 2026, 5);
  assert.match(href, /arrestDateFrom=2026-05-01/);
  assert.match(href, /arrestDateTo=2026-05-31/);
  const decoded = decodeURIComponent(href);
  assert.match(decoded, /returnTo=\/drug-intelligence\/command\?fy=2569/);
  assert.match(decoded, /province=ชุมพร/);
  assert.doesNotMatch(decoded.split("returnTo=")[1] ?? "", /arrestDateFrom=2026-05-01/);
});

test("unit row drill-down filters Cases but returns to original Commander scope", () => {
  const filter = resolveCommanderFilter(params({ fy: "2569", province: "ชุมพร" }));
  const href = commanderUnitCasesHref(filter, 16, "battalion");
  assert.match(href, /battalionId=16/);
  const decoded = decodeURIComponent(href);
  assert.match(decoded, /\/drug-intelligence\/command\?fy=2569/);
  assert.doesNotMatch(decoded.split("returnTo=")[1] ?? "", /battalionId=16/);
});

test("persons KPI drill-down carries Commander returnTo without PII", () => {
  const filter = resolveCommanderFilter(params({ fy: "2569", province: "ชุมพร" }));
  const href = commanderPersonsHref(filter);
  assert.match(href, /\/drug-intelligence\/persons\?/);
  assert.match(href, /caseRoles=/);
  const decoded = decodeURIComponent(href);
  assert.match(decoded, /returnTo=\/drug-intelligence\/command\?fy=2569/);
  assert.doesNotMatch(decoded, /citizen|phone|imei|personId/i);
});

test("duplicates and alerts attach commander returnTo only when filter is provided", () => {
  assert.equal(commanderDuplicatesHref(), "/drug-intelligence/review/duplicates");
  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  assert.match(commanderDuplicatesHref(filter), /returnTo=/);
  assert.match(decodeURIComponent(commanderDuplicatesHref(filter)), /\/drug-intelligence\/command\?fy=2569/);
});

test("list destinations render contextual return only via returnTo", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
  assert.match(read("app/drug-intelligence/cases/page.tsx"), /DrugContextualReturnLink/);
  assert.match(read("app/drug-intelligence/persons/page.tsx"), /DrugContextualReturnLink/);
  assert.match(read("app/drug-intelligence/alerts/page.tsx"), /DrugContextualReturnLink/);
  assert.match(read("app/drug-intelligence/review/duplicates/page.tsx"), /DrugContextualReturnLink/);
  assert.match(read("components/drug_intelligence/drug_contextual_return_link.tsx"), /getSafeReturnTo/);
  assert.match(read("components/drug_intelligence/drug_contextual_return_link.tsx"), /back-via-return-to/);
});
