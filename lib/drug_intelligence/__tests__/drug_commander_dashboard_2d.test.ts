/**
 * Tests for Commander Dashboard Phase 2D — decision support, comparison,
 * situation copy, readiness, and drill-down continuity.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_commander_dashboard_2d.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugCommanderDashboardService } from "@/lib/drug_intelligence/drug_commander_dashboard_service";
import { resolveCommanderFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import { commanderCasesHref, commanderReturnPath } from "@/lib/drug_intelligence/drug_commander_drilldown";
import {
  commanderHasActiveFilters,
  commanderReturnPathFromState,
  type CommanderUrlState,
} from "@/lib/drug_intelligence/drug_commander_scope";
import {
  buildCommanderSituationObservations,
  compareCommanderMetric,
  compareCommanderSeizures,
  filterForCommanderComparisonPeriod,
  formatCommanderDeltaCopy,
  formatCommanderPercent,
  resolveCommanderComparisonPeriod,
} from "@/lib/drug_intelligence/drug_commander_comparison";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());

function params(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "CMD-2D-001",
    title: "คดีทดสอบ 2D",
    status: "OPEN",
    arrestDate: new Date("2026-08-15"),
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
    province: "ชุมพร",
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

// ── Comparison period ────────────────────────────────────────────────────

test("custom August 2026 window compares to July 2026 of the same length", () => {
  const filter = resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31" }));
  const period = resolveCommanderComparisonPeriod(filter);
  assert.equal(period.kind, "previous-window");
  assert.equal(period.from.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(period.to.toISOString(), "2026-07-31T23:59:59.999Z");
});

test("FY 2569 compares against previous FY 2568", () => {
  const filter = resolveCommanderFilter(params({ fy: "2569" }));
  const period = resolveCommanderComparisonPeriod(filter);
  assert.equal(period.kind, "previous-fy");
  assert.equal(period.fiscalYear, 2025);
  assert.equal(period.fiscalYearBe, 2568);
  assert.equal(period.from.toISOString().slice(0, 10), "2024-10-01");
  assert.equal(period.to.toISOString().slice(0, 10), "2025-09-30");
  assert.equal(period.labelTh, "ปีงบประมาณ 2568");
});

test("comparison filter keeps org and province, only shifts the period", () => {
  const filter = resolveCommanderFilter(params({
    from: "2026-08-01",
    to: "2026-08-31",
    province: "ชุมพร",
    battalionId: "16",
  }));
  const previous = filterForCommanderComparisonPeriod(filter, resolveCommanderComparisonPeriod(filter));
  assert.equal(previous.province, "ชุมพร");
  assert.equal(previous.reportingBattalionId, 16);
  assert.equal(previous.arrestDateFrom.toISOString().slice(0, 10), "2026-07-01");
});

// ── Delta / zero denominator ─────────────────────────────────────────────

test("percentage is computed only when the previous value is positive", () => {
  const up = compareCommanderMetric(8, 5);
  assert.equal(up.absoluteChange, 3);
  assert.equal(up.direction, "up");
  assert.ok(up.percentChange !== null);
  assert.ok(Math.abs((up.percentChange ?? 0) - 60) < 0.001);
  assert.equal(formatCommanderPercent(up.percentChange), "+60%");
  assert.match(formatCommanderDeltaCopy(up, "คดี").changeText, /เพิ่มขึ้น 3 คดีจากช่วงก่อน/);

  const down = compareCommanderMetric(5, 7);
  assert.equal(down.direction, "down");
  assert.equal(formatCommanderPercent(down.percentChange), "−28.6%");
  assert.match(formatCommanderDeltaCopy(down, "คดี").changeText, /ลดลง 2 คดีจากช่วงก่อน/);

  const same = compareCommanderMetric(4, 4);
  assert.equal(same.direction, "same");
  assert.equal(formatCommanderDeltaCopy(same, "คดี").changeText, "เท่าเดิม");
});

test("zero previous denominator never yields Infinity", () => {
  const fromZero = compareCommanderMetric(5, 0);
  assert.equal(fromZero.percentChange, null);
  assert.equal(formatCommanderPercent(null), "ช่วงก่อนยังไม่มีข้อมูล");
  assert.doesNotMatch(formatCommanderPercent(fromZero.percentChange), /Infinity|NaN/);
  assert.equal(formatCommanderDeltaCopy(fromZero, "คดี").percentText, "ช่วงก่อนยังไม่มีข้อมูล");
});

test("queue metrics are not part of the comparison helper surface", () => {
  const compareSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_commander_comparison.ts"), "utf8");
  assert.doesNotMatch(compareSrc, /compareCommanderMetric\([^\)]*alert/i);
  assert.doesNotMatch(compareSrc, /pendingDuplicates/);
  const page = readFileSync(join(ROOT, "app/drug-intelligence/command/page.tsx"), "utf8");
  assert.match(page, /kpiQueueBadge/);
  assert.doesNotMatch(page, /compareCommanderMetric\(alertsCount/);
  assert.doesNotMatch(page, /compareCommanderMetric\(overviewData\?\.pendingDuplicatesCount/);
});

// ── Situation wording ────────────────────────────────────────────────────

test("situation observations are deterministic and avoid judgment language", () => {
  const observations = buildCommanderSituationObservations({
    caseCount: 5,
    caseDelta: compareCommanderMetric(5, 3),
    topProvince: { province: "ชุมพร", caseCount: 4 },
    topCountSeizure: { labelTh: "ยาบ้า", totalQuantity: 1000, displayUnit: "เม็ด" },
    newAlertsCount: 9,
    casesWithoutArrestedRoleCount: 1,
  });
  assert.ok(observations.length >= 3 && observations.length <= 5);
  assert.match(observations[0].textTh, /ช่วงที่เลือกมีคดี 5 คดี เพิ่มขึ้นจากช่วงก่อน 2 คดี/);
  assert.match(observations[1].textTh, /ชุมพรมีจำนวนคดีสูงสุดในช่วงที่เลือก 4 คดี/);
  assert.match(observations[2].textTh, /ยาบ้าเป็นของกลางที่พบมากที่สุด \(1,000 เม็ด\)/);
  assert.doesNotMatch(observations[2].textTh, /COUNT|MASS/);
  assert.doesNotMatch(observations[2].textEn, /COUNT|MASS/);
  assert.match(observations[3].textTh, /มีสัญญาณข่าวกรองใหม่ 9 รายการรอตรวจสอบ/);
  const joined = observations.map((o) => o.textTh).join(" ");
  assert.doesNotMatch(joined, /สถานการณ์รุนแรง|พื้นที่อันตราย|พื้นที่เสี่ยงสูง|หน่วยทำงานไม่ดี|risk score/i);
});

// ── COUNT / MASS isolation ───────────────────────────────────────────────

test("seizure comparison never mixes COUNT and MASS or different categories", () => {
  const compared = compareCommanderSeizures(
    [
      {
        drugCategory: "METHAMPHETAMINE_TABLET",
        labelTh: "ยาบ้า",
        measurementKind: "COUNT",
        totalQuantity: 400,
        totalWeightGrams: null,
        totalWeightKg: null,
        displayUnit: "เม็ด",
      },
      {
        drugCategory: "CRYSTAL_METHAMPHETAMINE",
        labelTh: "ไอซ์",
        measurementKind: "MASS",
        totalQuantity: null,
        totalWeightGrams: 2000,
        totalWeightKg: 2,
        displayUnit: null,
      },
    ],
    [
      {
        drugCategory: "METHAMPHETAMINE_TABLET",
        labelTh: "ยาบ้า",
        measurementKind: "COUNT",
        totalQuantity: 100,
        totalWeightGrams: null,
        totalWeightKg: null,
        displayUnit: "เม็ด",
      },
      {
        drugCategory: "CRYSTAL_METHAMPHETAMINE",
        labelTh: "ไอซ์",
        measurementKind: "MASS",
        totalQuantity: null,
        totalWeightGrams: 1000,
        totalWeightKg: 1,
        displayUnit: null,
      },
    ]
  );
  const meth = compared.find((row) => row.item.drugCategory === "METHAMPHETAMINE_TABLET");
  const ice = compared.find((row) => row.item.drugCategory === "CRYSTAL_METHAMPHETAMINE");
  assert.equal(meth?.delta.current, 400);
  assert.equal(meth?.delta.previous, 100);
  assert.equal(ice?.delta.current, 2);
  assert.equal(ice?.delta.previous, 1);
  assert.equal(meth?.item.measurementKind, "COUNT");
  assert.equal(ice?.item.measurementKind, "MASS");
});

// ── Service: previous period + readiness ─────────────────────────────────

test("getDecision compares August cases against July and reports readiness", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);

  await caseService.createCase(baseCase({
    caseNumber: "2D-JUL-1",
    arrestDate: new Date("2026-07-10"),
    province: "ชุมพร",
    battalionId: 16,
    latitude: 10.5,
    longitude: 99.1,
    persons: [newSuspect("ผู้ถูกจับ ก.ค.")],
    seizedItems: [
      { drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 100, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
    ],
  }));
  await caseService.createCase(baseCase({
    caseNumber: "2D-AUG-1",
    arrestDate: new Date("2026-08-10"),
    province: "ชุมพร",
    battalionId: 16,
    latitude: 10.5,
    longitude: 99.1,
    persons: [newSuspect("ผู้ถูกจับ ส.ค. 1")],
    seizedItems: [
      { drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 300, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
    ],
  }));
  await caseService.createCase(baseCase({
    caseNumber: "2D-AUG-2",
    arrestDate: new Date("2026-08-12"),
    province: "ระนอง",
    battalionId: null,
    latitude: null,
    longitude: null,
    seizedItems: [
      { drugCategory: "OTHER", measurementKind: "COUNT", drugType: "อื่น", quantity: 1, unit: "ชิ้น", weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: "ไม่ทราบ", subtype: null },
    ],
  }));

  const filter = resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31" }));
  const decision = await commanderService.getDecision(filter);
  const overview = await commanderService.getOverview(filter);

  assert.equal(overview.caseCount, 2);
  assert.equal(decision.previousCaseCount, 1);
  assert.equal(decision.previousArrestedPersonCount, 1);
  assert.equal(decision.comparisonPeriod.kind, "previous-window");
  const prevMeth = decision.previousSeizures.find((i) => i.drugCategory === "METHAMPHETAMINE_TABLET" && i.measurementKind === "COUNT");
  assert.equal(prevMeth?.totalQuantity, 100);
  assert.equal(decision.previousAreas.find((a) => a.province === "ชุมพร")?.caseCount, 1);
  assert.equal(decision.readiness.totalCases, 2);
  assert.equal(decision.readiness.casesMissingCoordinates, 1);
  assert.equal(decision.readiness.casesMissingReportingUnit, 1);
  assert.equal(decision.readiness.casesWithIncompleteSeizureCategory, 1);
  assert.equal(overview.casesWithoutArrestedRoleCount, 1);
});

test("getDecision FY comparison uses previous FY cases only", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);
  await caseService.createCase(baseCase({
    caseNumber: "2D-FY68",
    arrestDate: new Date("2025-03-10"),
    province: "ชุมพร",
  }));
  await caseService.createCase(baseCase({
    caseNumber: "2D-FY69",
    arrestDate: new Date("2026-03-10"),
    province: "ชุมพร",
  }));
  const decision = await commanderService.getDecision(resolveCommanderFilter(params({ fy: "2569" })));
  assert.equal(decision.comparisonPeriod.kind, "previous-fy");
  assert.equal(decision.comparisonPeriod.fiscalYearBe, 2568);
  assert.equal(decision.previousCaseCount, 1);
});

test("getDecision does not invent a universal unit score", async () => {
  const src = readFileSync(join(ROOT, "lib/drug_intelligence/drug_commander_dashboard_service.ts"), "utf8");
  assert.doesNotMatch(src, /riskScore|compositeScore|universalScore/);
  const ui = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_units_section.tsx"), "utf8");
  assert.match(ui, /unitsSortBasis/);
  assert.match(ui, /ข้อมูลยังไม่ระบุหน่วยรายงาน|unitsUnassigned|unitsEmptyAllUnassigned/);
});

test("area comparison uses previous province counts without risk wording", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_areas_section.tsx"), "utf8");
  assert.match(src, /areasHighInPeriod/);
  assert.doesNotMatch(src, /พื้นที่เสี่ยงสูง|high risk|risk score/i);
  assert.match(src, /commanderMapHref/);
  assert.match(src, /commanderCasesHref/);
});

test("units remain sorted by case count in the existing service", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);
  await caseService.createCase(baseCase({ caseNumber: "U-LOW", arrestDate: new Date("2026-08-10"), battalionId: 1 }));
  await caseService.createCase(baseCase({ caseNumber: "U-HIGH-1", arrestDate: new Date("2026-08-11"), battalionId: 2 }));
  await caseService.createCase(baseCase({ caseNumber: "U-HIGH-2", arrestDate: new Date("2026-08-12"), battalionId: 2 }));
  const units = await commanderService.getUnits(resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31" })));
  assert.equal(units.rows[0]?.unitId, 2);
  assert.equal(units.rows[0]?.caseCount, 2);
  assert.equal(units.rows[1]?.unitId, 1);
});

// ── Return / reset / picker regression ───────────────────────────────────

test("returnTo still restores Commander custom dates and province", () => {
  const filter = resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31", province: "ชุมพร" }));
  const urlState: CommanderUrlState = { from: "2026-08-01", to: "2026-08-31", province: "ชุมพร" };
  const path = commanderReturnPath(filter, urlState);
  assert.match(path, /from=2026-08-01/);
  assert.match(path, /to=2026-08-31/);
  const href = commanderCasesHref(filter, { province: "ระนอง" }, urlState);
  const decoded = decodeURIComponent(href);
  assert.match(decoded, /arrestDateFrom=2026-08-01/);
  assert.match(decoded, /province=ระนอง/);
  assert.match(decoded, /returnTo=\/drug-intelligence\/command\?from=2026-08-01&to=2026-08-31/);
  assert.doesNotMatch(decoded, /focusId=|phone=/);
});

test("reset remains Production-safe window.location.assign", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_filter_bar.tsx"), "utf8");
  assert.match(src, /window\.location\.assign\("\/drug-intelligence\/command"\)/);
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ""), /router\.push\("\/drug-intelligence\/command"/);
  assert.equal(commanderReturnPathFromState({}), "/drug-intelligence/command");
  assert.equal(commanderHasActiveFilters({ from: "2026-08-01", to: "2026-08-31" }), true);
});

test("ThaiDatePicker contract is unchanged", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_filter_bar.tsx"), "utf8");
  assert.match(src, /ThaiDatePicker/);
  assert.match(src, /outputFormat="iso"/);
  assert.doesNotMatch(src, /type=["']date["']/);
});

test("page does not put person or phone identifiers in Commander overview URLs", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/command/page.tsx"), "utf8");
  assert.doesNotMatch(page, /phoneNumber|personId=|focusId=/);
  assert.match(page, /useCommanderDecision/);
  assert.match(page, /commander-comparison-scope/);
});

test("trend chart still uses HTML labels, not compressed SVG text", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_trend_chart.tsx"), "utf8");
  assert.match(src, /data-testid="commander-trend-chart"/);
  assert.doesNotMatch(src, /preserveAspectRatio="none"/);
  assert.doesNotMatch(src, /<text[\s>]/);
});

test("decision handler requires drug.read like other Commander APIs", async () => {
  const { handleCommanderDecision } = await import("@/lib/drug_intelligence/drug_commander_api_handlers");
  const { SESSION_COOKIE_NAME } = await import("@/lib/auth/auth_config");
  const db = new InMemoryDatabaseClient();
  const service = new DrugCommanderDashboardService(db);
  const denied = await handleCommanderDecision(
    service,
    params({}),
    "mock:1101700123456",
    new Request("http://localhost/api/drug-intelligence/command/decision?actorId=mock:1101700123456", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=test-session` },
    })
  );
  assert.equal(denied.status, 403);

  const allowed = await handleCommanderDecision(
    service,
    params({}),
    "mock:bpp414",
    new Request("http://localhost/api/drug-intelligence/command/decision?actorId=mock:bpp414", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=test-session` },
    })
  );
  assert.equal(allowed.status, 200);
});

test("no AI, risk score, or factual writes were introduced in Phase 2D", () => {
  const files = [
    "lib/drug_intelligence/drug_commander_comparison.ts",
    "lib/drug_intelligence/drug_commander_dashboard_service.ts",
    "app/drug-intelligence/command/page.tsx",
  ];
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(src, /openai|anthropic|llm|predictive|risk score|riskScore/i);
    assert.doesNotMatch(src, /\.create\(|\.update\(|\.delete\(/);
  }
});
