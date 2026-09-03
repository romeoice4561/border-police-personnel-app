/**
 * Tests for Commander Dashboard Phase 2C — filter truth, Thai calendar UX,
 * period vs queue KPIs, org sanitization, return restoration.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_commander_dashboard_2c.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugCommanderDashboardService } from "@/lib/drug_intelligence/drug_commander_dashboard_service";
import {
  commanderInvalidDateRangeMessage,
  resolveCommanderFilter,
} from "@/lib/drug_intelligence/drug_commander_filter";
import {
  commanderCasesHref,
  commanderReturnPath,
} from "@/lib/drug_intelligence/drug_commander_drilldown";
import {
  COMMANDER_INCOMPLETE_RANGE_MESSAGE_TH,
  COMMANDER_INVALID_RANGE_MESSAGE_TH,
  commanderPeriodApiDates,
  commanderPeriodKind,
  commanderPeriodQueryEnabled,
  commanderReturnPathFromState,
  formatCommanderIsoThai,
  formatCommanderPeriodLabel,
  sanitizeCommanderOrgState,
  commanderHasActiveFilters,
  type CommanderUrlState,
} from "@/lib/drug_intelligence/drug_commander_scope";
import { shiftBuddhistCalendarMonth, yearBEToGregorian, yearGregorianToBE } from "@/lib/officer_profile/thai_date";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import { parseThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";
import type { OrgTree } from "@/lib/organization/org_tree";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());

function params(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "CMD-2C-001",
    title: "คดีทดสอบ 2C",
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

const TREE: OrgTree = {
  headquarters: [{ id: 1, code: "HQ", nameTh: "บช.ตชด." }],
  regions: [
    { id: 10, code: "4", nameTh: "ภาค 4", headquartersId: 1 },
    { id: 20, code: "1", nameTh: "ภาค 1", headquartersId: 1 },
  ],
  battalions: [
    { id: 100, code: "41", nameTh: "กก.41", regionId: 10 },
    { id: 200, code: "11", nameTh: "กก.11", regionId: 20 },
  ],
  companies: [
    { id: 1000, code: "411", nameTh: "ร้อย.411", battalionId: 100 },
    { id: 2000, code: "111", nameTh: "ร้อย.111", battalionId: 200 },
  ],
};

// ── Native date input removed ─────────────────────────────────────────────

test("Commander filter bar no longer uses native mm/dd/yyyy date inputs", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_filter_bar.tsx"), "utf8");
  assert.doesNotMatch(src, /type=["']date["']/);
  assert.match(src, /ThaiDatePicker/);
  assert.match(src, /outputFormat="iso"/);
  assert.match(src, /displayFormat="short"/);
  assert.match(src, /commitOnBrowse=\{false\}/);
  assert.match(src, /data-testid="commander-date-from"/);
  assert.match(src, /data-testid="commander-date-to"/);
});

test("ThaiDatePicker exposes Thai month navigation and Buddhist header", () => {
  const src = readFileSync(join(ROOT, "components/ui/thai_date_picker.tsx"), "utf8");
  assert.match(src, /aria-label="เดือนก่อน"/);
  assert.match(src, /aria-label="เดือนถัดไป"/);
  assert.match(src, /THAI_MONTHS\[month\]\} \{yearBE\}/);
  assert.match(src, /max-w-\[calc\(100vw-16px\)\]/);
  assert.match(src, /h-9 w-9/);
  assert.match(src, /aria-pressed/);
});

test("Commander page wires custom dates as Gregorian ISO API params", () => {
  const src = readFileSync(join(ROOT, "app/drug-intelligence/command/page.tsx"), "utf8");
  assert.match(src, /commanderPeriodApiDates/);
  assert.match(src, /commanderPeriodQueryEnabled/);
  assert.doesNotMatch(src, /type=["']date["']/);
});

// ── Thai / Buddhist presentation + BE/CE ─────────────────────────────────

test("ISO 2026-09-03 displays as 3 ก.ย. 2569, never mm/dd/yyyy", () => {
  assert.equal(formatCommanderIsoThai("2026-09-03"), "3 ก.ย. 2569");
  assert.doesNotMatch(formatCommanderIsoThai("2026-09-03"), /09\/03/);
  assert.doesNotMatch(formatCommanderIsoThai("2026-09-03"), /2026/);
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_filter_bar.tsx"), "utf8");
  assert.equal((src.match(/type=["']date["']/g) || []).length, 0);
  assert.ok((src.match(/ThaiDatePicker/g) || []).length >= 2);
});

test("August 2569 Buddhist display converts to Gregorian ISO 2026-08-01", () => {
  assert.equal(yearBEToGregorian(2569), 2026);
  assert.equal(yearGregorianToBE(2026), 2569);
  const date = parseThaiPersonnelDate("2026-08-01");
  assert.ok(date);
  assert.equal(date.toISOString().slice(0, 10), "2026-08-01");
  assert.equal(formatShortThaiDateTh(date), "1 ส.ค. 2569");
  assert.equal(formatCommanderIsoThai("2026-08-01"), "1 ส.ค. 2569");
  assert.equal(formatCommanderIsoThai("2026-08-31"), "31 ส.ค. 2569");
});

test("custom August 2569 range label is 1–31 ส.ค. 2569 and keeps Gregorian URL", () => {
  const state: CommanderUrlState = { from: "2026-08-01", to: "2026-08-31" };
  assert.equal(commanderPeriodKind(state), "custom");
  assert.equal(formatCommanderPeriodLabel(state, "ปีงบประมาณ 2569"), "1–31 ส.ค. 2569");
  assert.deepEqual(commanderPeriodApiDates(state), { from: "2026-08-01", to: "2026-08-31" });
  const filter = resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31", fy: "2569" }));
  assert.equal(filter.arrestDateFrom.toISOString().slice(0, 10), "2026-08-01");
  assert.equal(filter.arrestDateTo.toISOString().slice(0, 10), "2026-08-31");
  assert.equal(filter.fiscalYear, undefined);
});

test("Dec → Jan Buddhist year boundary does not corrupt Gregorian ISO", () => {
  const next = shiftBuddhistCalendarMonth(2568, 12, 1);
  assert.equal(next.month, 1);
  assert.equal(next.yearBE, 2569);
  const prev = shiftBuddhistCalendarMonth(2569, 1, -1);
  assert.equal(prev.month, 12);
  assert.equal(prev.yearBE, 2568);
  const fromIso = `${yearBEToGregorian(next.yearBE)}-${String(next.month).padStart(2, "0")}-01`;
  assert.equal(fromIso, "2026-01-01");
});

test("Sep → Oct stays in the same Buddhist year", () => {
  const next = shiftBuddhistCalendarMonth(2569, 9, 1);
  assert.equal(next.month, 10);
  assert.equal(next.yearBE, 2569);
});

// ── Period kind / invalid / partial / clear ──────────────────────────────

test("default URL with no dates is FY mode", () => {
  assert.equal(commanderPeriodKind({}), "fy");
  assert.equal(commanderPeriodQueryEnabled({}), true);
  assert.deepEqual(commanderPeriodApiDates({ fy: "2569" }), { fy: 2569 });
});

test("from-only or to-only is incomplete and does not send custom dates to APIs", () => {
  assert.equal(commanderPeriodKind({ from: "2026-08-01" }), "incomplete");
  assert.equal(commanderPeriodKind({ to: "2026-08-31" }), "incomplete");
  assert.equal(commanderPeriodQueryEnabled({ from: "2026-08-01" }), false);
  assert.deepEqual(commanderPeriodApiDates({ from: "2026-08-01" }), {});
  assert.deepEqual(commanderPeriodApiDates({ from: "2026-08-01", fy: "2569" }), { fy: 2569 });
  const filter = resolveCommanderFilter(params({ from: "2026-08-01", fy: "2569" }));
  assert.equal(filter.fiscalYearBe, 2569, "partial custom date keeps FY analytics");
  assert.equal(COMMANDER_INCOMPLETE_RANGE_MESSAGE_TH, "กรุณาเลือกทั้งวันที่เริ่มต้นและวันที่สิ้นสุด");
});

test("from > to is invalid, keeps values, and does not swap", () => {
  const state = { from: "2026-08-31", to: "2026-08-01" };
  assert.equal(commanderPeriodKind(state), "invalid");
  assert.equal(commanderPeriodQueryEnabled(state), false);
  assert.deepEqual(commanderPeriodApiDates(state), {});
  assert.equal(
    commanderInvalidDateRangeMessage(params({ from: "2026-08-31", to: "2026-08-01" })),
    "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"
  );
  assert.equal(COMMANDER_INVALID_RANGE_MESSAGE_TH, "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");
  const filter = resolveCommanderFilter(params({ from: "2026-08-31", to: "2026-08-01", fy: "2569" }));
  assert.equal(filter.fiscalYearBe, 2569, "resolver does not silently swap inverted dates");
  assert.notEqual(filter.arrestDateFrom.toISOString().slice(0, 10), "2026-08-31");
});

test("clearing both custom dates returns FY period semantics", () => {
  const cleared: CommanderUrlState = { fy: "2569" };
  assert.equal(commanderPeriodKind(cleared), "fy");
  assert.equal(formatCommanderPeriodLabel(cleared, "ปีงบประมาณ 2569"), "ปีงบประมาณ 2569");
  assert.equal(commanderReturnPathFromState({}), "/drug-intelligence/command");
});

test("FY select is not the active scope label while custom dates are authoritative", () => {
  const label = formatCommanderPeriodLabel(
    { fy: "2569", from: "2026-08-01", to: "2026-08-31" },
    "ปีงบประมาณ 2569"
  );
  assert.equal(label, "1–31 ส.ค. 2569");
  assert.doesNotMatch(label, /ปีงบประมาณ 2569/);
});

// ── Org cascade sanitization ─────────────────────────────────────────────

test("sanitizeCommanderOrgState drops region/battalion/company that do not belong to parent", () => {
  const stale: CommanderUrlState = { hqId: "1", regionId: "10", battalionId: "200", companyId: "2000" };
  const next = sanitizeCommanderOrgState(stale, TREE);
  assert.equal(next.hqId, "1");
  assert.equal(next.regionId, "10");
  assert.equal(next.battalionId, undefined);
  assert.equal(next.companyId, undefined);
});

test("sanitizeCommanderOrgState keeps a valid reporting-unit path", () => {
  const valid: CommanderUrlState = { hqId: "1", regionId: "10", battalionId: "100", companyId: "1000" };
  assert.deepEqual(sanitizeCommanderOrgState(valid, TREE), valid);
});

// ── ReturnTo restoration ─────────────────────────────────────────────────

test("returnTo restores custom Gregorian ISO dates, not resolved FY bounds", () => {
  const filter = resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31", province: "ชุมพร" }));
  const urlState: CommanderUrlState = { from: "2026-08-01", to: "2026-08-31", province: "ชุมพร" };
  const path = commanderReturnPath(filter, urlState);
  assert.match(path, /from=2026-08-01/);
  assert.match(path, /to=2026-08-31/);
  assert.match(path, /province=ชุมพร/);
  assert.doesNotMatch(path, /[?&]fy=/);
  const href = commanderCasesHref(filter, undefined, urlState);
  const decoded = decodeURIComponent(href);
  assert.match(decoded, /returnTo=\/drug-intelligence\/command\?from=2026-08-01&to=2026-08-31/);
});

test("alerts drill-down returnTo keeps Commander custom dates without applying FY to alerts query", () => {
  const src = readFileSync(join(ROOT, "lib/drug_intelligence/drug_commander_drilldown.ts"), "utf8");
  assert.match(src, /function commanderAlertsHref/);
  const hrefSrc = src.slice(src.indexOf("export function commanderAlertsHref"), src.indexOf("export function commanderDuplicatesHref"));
  assert.doesNotMatch(hrefSrc, /setIf\(params, "fy"/);
  assert.doesNotMatch(hrefSrc, /setIf\(params, "from"/);
});

// ── Service: completeness + unassigned ───────────────────────────────────

test("service.getOverview: casesWithoutArrestedRoleCount does not change arrested-person semantics", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);
  await caseService.createCase(
    baseCase({
      caseNumber: "CMD-2C-ARRESTED",
      arrestDate: new Date("2026-08-10"),
      persons: [newSuspect("ผู้ถูกจับ")],
    })
  );
  await caseService.createCase(
    baseCase({
      caseNumber: "CMD-2C-NO-PERSON",
      arrestDate: new Date("2026-08-11"),
      persons: [],
    })
  );
  const overview = await commanderService.getOverview(
    resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31" }))
  );
  assert.equal(overview.caseCount, 2);
  assert.equal(overview.arrestedPersonCount, 1);
  assert.equal(overview.casesWithoutArrestedRoleCount, 1);
});

test("service.getUnits: unassigned cases are counted separately from ranked named units", async () => {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);
  await caseService.createCase(
    baseCase({ caseNumber: "CMD-2C-NAMED", arrestDate: new Date("2026-08-10"), battalionId: 16 })
  );
  await caseService.createCase(
    baseCase({ caseNumber: "CMD-2C-NULL", arrestDate: new Date("2026-08-11"), battalionId: null })
  );
  const units = await commanderService.getUnits(
    resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31" }))
  );
  assert.equal(units.assignedCaseCount, 1);
  assert.equal(units.unassignedCaseCount, 1);
  assert.equal(units.rows.length, 1);
  assert.equal(units.rows[0]?.unitId, 16);
});

// ── Accessibility copy ───────────────────────────────────────────────────

test("Commander date fields use Buddhist-era accessible labels", () => {
  const dict = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");
  assert.match(dict, /วันที่เริ่มต้น พ\.ศ\./);
  assert.match(dict, /วันที่สิ้นสุด พ\.ศ\./);
  const bar = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_filter_bar.tsx"), "utf8");
  assert.match(bar, /filterFromAria/);
  assert.match(bar, /filterToAria/);
  assert.match(bar, /aria-describedby/);
  assert.match(bar, /role="alert"/);
});

// ── Phase 2C.1 Production-safe reset ─────────────────────────────────────

test("Commander reset uses Production-safe window.location.assign, not same-pathname router.push", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_filter_bar.tsx"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(code, /resetCommanderFilters/);
  assert.match(code, /window\.location\.assign\("\/drug-intelligence\/command"\)/);
  assert.match(code, /onClick=\{resetCommanderFilters\}/);
  assert.doesNotMatch(code, /router\.push\("\/drug-intelligence\/command"/);
  assert.match(code, /data-testid="commander-filter-reset"/);
});

test("Commander reset target is the canonical clean path with no query filters", () => {
  assert.equal(commanderReturnPathFromState({}), "/drug-intelligence/command");
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_filter_bar.tsx"), "utf8");
  const assign = src.match(/window\.location\.assign\("([^"]+)"\)/);
  assert.equal(assign?.[1], "/drug-intelligence/command");
  assert.doesNotMatch(assign?.[1] ?? "", /\?/);
  const keys = ["fy", "from", "to", "hqId", "regionId", "battalionId", "companyId", "province", "status"];
  for (const key of keys) {
    assert.doesNotMatch(assign?.[1] ?? "", new RegExp(`[?&]${key}=`));
  }
});

test("empty Commander URL state is not an active-filter set, so reset is idempotent when already clean", () => {
  assert.equal(commanderHasActiveFilters({}), false);
  assert.equal(commanderHasActiveFilters({ from: "2026-08-01", to: "2026-08-31" }), true);
  assert.equal(commanderHasActiveFilters({ fy: "2569" }), true);
  assert.equal(commanderHasActiveFilters({ province: "ชุมพร" }), true);
});
