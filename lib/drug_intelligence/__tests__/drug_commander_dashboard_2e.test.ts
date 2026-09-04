/**
 * Tests for Commander Dashboard Phase 2E — executive attention,
 * completeness drill-down truth, filter compaction, returnTo continuity.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_commander_dashboard_2e.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugCommanderDashboardService } from "@/lib/drug_intelligence/drug_commander_dashboard_service";
import { resolveCommanderFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import {
  commanderAlertsHref,
  commanderCompletenessCasesHref,
  commanderDuplicatesHref,
  commanderReturnPath,
} from "@/lib/drug_intelligence/drug_commander_drilldown";
import { buildCommanderAttentionItems } from "@/lib/drug_intelligence/drug_commander_attention";
import { drugCaseListQuerySchema } from "@/lib/drug_intelligence/drug_case_api_schemas";
import { getSafeReturnTo } from "@/lib/ui/return_context";
import { returnToBackLabelKey } from "@/lib/ui/return_to_back_label";
import { translate, type TranslationKey } from "@/lib/i18n/dictionary";
import type { CommanderUrlState } from "@/lib/drug_intelligence/drug_commander_scope";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());

function params(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "CMD-2E-001",
    title: "คดีทดสอบ 2E",
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

async function seedAugustReadiness() {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  const commanderService = new DrugCommanderDashboardService(db);

  await caseService.createCase(baseCase({
    caseNumber: "2E-AUG-COMPLETE",
    arrestDate: new Date("2026-08-10"),
    province: "ชุมพร",
    battalionId: 16,
    latitude: 10.5,
    longitude: 99.1,
    persons: [newSuspect("ผู้ถูกจับ ส.ค.")],
    seizedItems: [
      { drugCategory: "METHAMPHETAMINE_TABLET", measurementKind: "COUNT", drugType: "ยาบ้า", quantity: 300, unit: "เม็ด", weightGrams: null, packageCount: null, notes: null, otherDrugCategoryLabel: null, subtype: null },
    ],
  }));
  await caseService.createCase(baseCase({
    caseNumber: "2E-AUG-INCOMPLETE",
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
  return { db, caseService, commanderService, filter };
}

function urlStateFromFilter(): CommanderUrlState {
  return { from: "2026-08-01", to: "2026-08-31" };
}

// ── Attention summary ────────────────────────────────────────────────────

test("attention omits zero counts and groups review vs complete without a risk score", () => {
  const items = buildCommanderAttentionItems({
    newAlertsCount: 9,
    pendingDuplicatesCount: 0,
    missingArrestedCount: 8,
    missingUnitCount: 3,
    missingCoordsCount: 0,
    alertsHref: "/drug-intelligence/alerts?status=NEW",
    duplicatesHref: "/drug-intelligence/review/duplicates",
    missingArrestedHref: "/drug-intelligence/cases?completeness=missingArrested",
    missingUnitHref: "/drug-intelligence/cases?completeness=missingReportingUnit",
    missingCoordsHref: "/drug-intelligence/cases?completeness=missingCoordinates",
  });

  assert.deepEqual(items.map((item) => item.id), ["new-alerts", "missing-arrested", "missing-unit"]);
  assert.equal(items.find((item) => item.id === "new-alerts")?.group, "review");
  assert.equal(items.find((item) => item.id === "missing-arrested")?.group, "complete");
  assert.equal(items.find((item) => item.id === "missing-unit")?.group, "complete");
  assert.equal(items.find((item) => item.id === "duplicates"), undefined);
  assert.equal(items.find((item) => item.id === "missing-coords"), undefined);

  const src = [
    readFileSync(join(ROOT, "lib/drug_intelligence/drug_commander_attention.ts"), "utf8"),
    readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_attention_section.tsx"), "utf8"),
    readFileSync(join(ROOT, "app/drug-intelligence/command/page.tsx"), "utf8"),
  ].join("\n");
  assert.doesNotMatch(src, /riskScore|threatScore|performanceScore|criminality|openai|anthropic|llm/i);
});

test("attention counts match Commander overview + decision readiness", async () => {
  const { commanderService, filter } = await seedAugustReadiness();
  const overview = await commanderService.getOverview(filter);
  const decision = await commanderService.getDecision(filter);
  const urlState = urlStateFromFilter();

  const items = buildCommanderAttentionItems({
    newAlertsCount: overview.newAlertsCount,
    pendingDuplicatesCount: overview.pendingDuplicatesCount,
    missingArrestedCount: overview.casesWithoutArrestedRoleCount,
    missingUnitCount: decision.readiness.casesMissingReportingUnit,
    missingCoordsCount: decision.readiness.casesMissingCoordinates,
    alertsHref: commanderAlertsHref({ status: "NEW" }, filter, urlState),
    duplicatesHref: commanderDuplicatesHref(filter, urlState),
    missingArrestedHref: commanderCompletenessCasesHref(filter, "missingArrested", urlState),
    missingUnitHref: commanderCompletenessCasesHref(filter, "missingReportingUnit", urlState),
    missingCoordsHref: commanderCompletenessCasesHref(filter, "missingCoordinates", urlState),
  });

  assert.equal(overview.caseCount, 2);
  assert.equal(overview.casesWithoutArrestedRoleCount, 1);
  assert.equal(decision.readiness.casesMissingReportingUnit, 1);
  assert.equal(decision.readiness.casesMissingCoordinates, 1);
  assert.equal(items.find((item) => item.id === "missing-arrested")?.count, 1);
  assert.equal(items.find((item) => item.id === "missing-unit")?.count, 1);
  assert.equal(items.find((item) => item.id === "missing-coords")?.count, 1);
});

test("completeness hrefs carry exact destination filters and Commander returnTo", () => {
  const filter = resolveCommanderFilter(params({
    from: "2026-08-01",
    to: "2026-08-31",
    province: "ชุมพร",
    hqId: "1",
    regionId: "4",
  }));
  const urlState: CommanderUrlState = {
    from: "2026-08-01",
    to: "2026-08-31",
    province: "ชุมพร",
    hqId: "1",
    regionId: "4",
  };

  const arrested = decodeURIComponent(commanderCompletenessCasesHref(filter, "missingArrested", urlState));
  assert.match(arrested, /completeness=missingArrested/);
  assert.doesNotMatch(arrested.split("returnTo=")[0] ?? arrested, /unitGroup=/);
  assert.match(arrested, /arrestDateFrom=2026-08-01/);
  assert.match(arrested, /arrestDateTo=2026-08-31/);
  assert.match(arrested, /province=ชุมพร/);
  assert.match(arrested, /headquartersId=1/);
  assert.match(arrested, /regionId=4/);
  assert.match(arrested, /returnTo=\/drug-intelligence\/command\?from=2026-08-01&to=2026-08-31/);
  assert.doesNotMatch(arrested, /focusId=|phone=|personId=/);

  const unit = decodeURIComponent(commanderCompletenessCasesHref(filter, "missingReportingUnit", urlState));
  assert.match(unit, /completeness=missingReportingUnit/);
  assert.match(unit, /unitGroup=battalion/);

  const hqOnly = resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31", hqId: "1" }));
  const hqHref = decodeURIComponent(commanderCompletenessCasesHref(hqOnly, "missingReportingUnit", { from: "2026-08-01", to: "2026-08-31", hqId: "1" }));
  assert.match(hqHref, /unitGroup=region/);

  const coords = decodeURIComponent(commanderCompletenessCasesHref(filter, "missingCoordinates", urlState));
  assert.match(coords, /completeness=missingCoordinates/);

  const alerts = decodeURIComponent(commanderAlertsHref({ status: "NEW" }, filter, urlState));
  assert.match(alerts, /\/drug-intelligence\/alerts\?status=NEW/);
  assert.match(alerts, /returnTo=\/drug-intelligence\/command\?/);

  const duplicates = decodeURIComponent(commanderDuplicatesHref(filter, urlState));
  assert.match(duplicates, /\/drug-intelligence\/review\/duplicates\?returnTo=\/drug-intelligence\/command\?/);
});

test("listCases completeness filters return the same N as Commander readiness", async () => {
  const { caseService, commanderService, filter } = await seedAugustReadiness();
  const overview = await commanderService.getOverview(filter);
  const decision = await commanderService.getDecision(filter);
  const window = { arrestDateFrom: new Date("2026-08-01"), arrestDateTo: new Date("2026-08-31") };

  const missingArrested = await caseService.listCases({ page: 1, pageSize: 20, completeness: "missingArrested", ...window });
  assert.equal(missingArrested.total, overview.casesWithoutArrestedRoleCount);
  assert.equal(missingArrested.rows.length, 1);
  assert.equal(missingArrested.rows[0]?.caseNumber, "2E-AUG-INCOMPLETE");

  const missingUnit = await caseService.listCases({
    page: 1,
    pageSize: 20,
    completeness: "missingReportingUnit",
    unitGroup: "battalion",
    ...window,
  });
  assert.equal(missingUnit.total, decision.readiness.casesMissingReportingUnit);

  const missingCoords = await caseService.listCases({ page: 1, pageSize: 20, completeness: "missingCoordinates", ...window });
  assert.equal(missingCoords.total, decision.readiness.casesMissingCoordinates);

  const incompleteSeizure = await caseService.listCases({ page: 1, pageSize: 20, completeness: "incompleteSeizure", ...window });
  assert.equal(incompleteSeizure.total, decision.readiness.casesWithIncompleteSeizureCategory);

  const completeCase = await caseService.listCases({ page: 1, pageSize: 20, completeness: "missingArrested", ...window, province: "ชุมพร" });
  assert.equal(completeCase.total, 0);
});

test("Cases list query schema accepts completeness and unitGroup only as known enums", () => {
  const ok = drugCaseListQuerySchema.safeParse({
    completeness: "missingCoordinates",
    unitGroup: "battalion",
    arrestDateFrom: "2026-08-01",
    arrestDateTo: "2026-08-31",
  });
  assert.equal(ok.success, true);

  const fake = drugCaseListQuerySchema.safeParse({ completeness: "highRisk" });
  assert.equal(fake.success, false);

  const casesPage = readFileSync(join(ROOT, "app/drug-intelligence/cases/page.tsx"), "utf8");
  assert.match(casesPage, /completeness/);
  assert.match(casesPage, /cases-completeness-banner/);
  assert.match(casesPage, /isCaseCompletenessFilter/);
});

test("Commander page wires attention above KPIs and completeness drill-downs", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/command/page.tsx"), "utf8");
  const attentionIdx = page.indexOf("<CommanderAttentionSection");
  const kpiIdx = page.indexOf("overview-heading");
  const actionsIdx = page.lastIndexOf("<CommanderActionsSection");
  assert.ok(attentionIdx > 0 && kpiIdx > attentionIdx, "attention must appear before KPIs");
  assert.ok(actionsIdx > kpiIdx, "detailed Action Center stays below KPIs");
  assert.match(page, /commanderCompletenessCasesHref\(filter, "missingArrested"/);
  assert.match(page, /commanderCompletenessCasesHref\(filter, "missingReportingUnit"/);
  assert.match(page, /commanderCompletenessCasesHref\(filter, "missingCoordinates"/);
  assert.match(page, /commanderCompletenessCasesHref\(filter, "incompleteSeizure"/);
  assert.match(page, /commanderAlertsHref\(\{ status: "NEW" \}/);
  assert.doesNotMatch(page, /sticky /);
  assert.doesNotMatch(page, /riskScore|threat score|AI conclusion/i);
});

test("filter bar is compacted without hiding scope truth or resetting via same-pathname push", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_filter_bar.tsx"), "utf8");
  assert.match(src, /data-testid="commander-filter-summary"/);
  assert.match(src, /filterSummary/);
  assert.match(src, /hidden min-w-\[9\.5rem\] flex-col gap-0\.5 md:flex/);
  assert.match(src, /data-testid="commander-filter-org-mobile"/);
  assert.match(src, /md:hidden/);
  assert.match(src, /ThaiDatePicker/);
  assert.match(src, /window\.location\.assign\("\/drug-intelligence\/command"\)/);
  assert.match(src, /data-testid="commander-filter-reset"/);
  assert.doesNotMatch(src, /type=["']date["']/);
});

test("FY, custom, org, and province scopes remain in completeness returnTo", () => {
  const fy = resolveCommanderFilter(params({ fy: "2569", battalionId: "16" }));
  const fyHref = decodeURIComponent(commanderCompletenessCasesHref(fy, "missingArrested", { fy: "2569", battalionId: "16" }));
  assert.match(fyHref, /returnTo=\/drug-intelligence\/command\?fy=2569/);
  assert.match(fyHref, /battalionId=16/);

  const custom = resolveCommanderFilter(params({ from: "2026-08-01", to: "2026-08-31", province: "ชุมพร" }));
  const customPath = commanderReturnPath(custom, { from: "2026-08-01", to: "2026-08-31", province: "ชุมพร" });
  assert.equal(customPath, "/drug-intelligence/command?from=2026-08-01&to=2026-08-31&province=ชุมพร");
});

test("direct Cases navigation does not invent a Commander return", () => {
  assert.equal(getSafeReturnTo(new URLSearchParams()), null);
  assert.equal(getSafeReturnTo(new URLSearchParams({ completeness: "missingArrested" })), null);
  assert.equal(returnToBackLabelKey("/drug-intelligence/cases"), "di.rel.backGeneric");
  assert.equal(returnToBackLabelKey("/drug-intelligence/command?from=2026-08-01&to=2026-08-31"), "di.command.backToDashboard");

  const casesPage = readFileSync(join(ROOT, "app/drug-intelligence/cases/page.tsx"), "utf8");
  assert.match(casesPage, /DrugContextualReturnLink/);
  assert.doesNotMatch(casesPage, /di\.command\.backToDashboard/);
});

test("attention and list completeness copy exist in TH/EN without raw keys or COUNT/MASS", () => {
  const keys: TranslationKey[] = [
    "di.command.attentionTitle",
    "di.command.attentionNote",
    "di.command.attentionReview",
    "di.command.attentionComplete",
    "di.command.attentionEmpty",
    "di.command.attentionSignals",
    "di.command.attentionDuplicates",
    "di.command.attentionMissingArrested",
    "di.command.attentionMissingUnit",
    "di.command.attentionMissingCoords",
    "di.command.readinessNotScore",
    "di.list.completenessBanner",
    "di.list.completeness.missingArrested",
    "di.list.completeness.missingReportingUnit",
    "di.list.completeness.missingCoordinates",
    "di.list.completeness.incompleteSeizure",
  ];
  for (const key of keys) {
    const th = translate(key, "th");
    const en = translate(key, "en");
    assert.notEqual(th, key);
    assert.notEqual(en, key);
    assert.notEqual(th, en);
    assert.doesNotMatch(th, /COUNT|MASS/);
    assert.doesNotMatch(en, /COUNT|MASS/);
    assert.doesNotMatch(th, /riskScore|threatScore/);
    assert.doesNotMatch(en, /riskScore|threatScore/);
  }
  assert.equal(translate("di.command.attentionTitle", "th"), "เรื่องที่ควรตรวจสอบ");
  assert.equal(translate("di.command.attentionReview", "th"), "ควรตรวจสอบ");
  assert.equal(translate("di.command.attentionComplete", "th"), "ควรเติมข้อมูล");
});

test("units unassigned copy remains actionable to missingReportingUnit cases", () => {
  const src = readFileSync(join(ROOT, "components/drug_intelligence/drug_commander_units_section.tsx"), "utf8");
  assert.match(src, /unitsSortBasis/);
  assert.match(src, /commanderCompletenessCasesHref\(filter, "missingReportingUnit"/);
  assert.match(src, /commander-units-unassigned/);
  assert.doesNotMatch(src, /performanceScore|riskScore/);
});

test("situation missing-arrested observation now opens completeness Cases, not an unfiltered list", () => {
  const comparison = readFileSync(join(ROOT, "lib/drug_intelligence/drug_commander_comparison.ts"), "utf8");
  assert.match(comparison, /id: "missing-arrested"/);
  assert.match(comparison, /href: "cases"/);
  const page = readFileSync(join(ROOT, "app/drug-intelligence/command/page.tsx"), "utf8");
  assert.match(page, /obs.id === "missing-arrested"/);
  assert.match(page, /commanderCompletenessCasesHref\(filter, "missingArrested"/);
});

test("Phase 2B/2C/2D/2D.1, Map, 1B, 1C, and Network regression files remain", () => {
  const files = [
    "lib/drug_intelligence/__tests__/drug_commander_dashboard_2b.test.ts",
    "lib/drug_intelligence/__tests__/drug_commander_dashboard_2c.test.ts",
    "lib/drug_intelligence/__tests__/drug_commander_dashboard_2d.test.ts",
    "lib/drug_intelligence/__tests__/drug_commander_i18n_2d1.test.ts",
    "lib/drug_intelligence/__tests__/drug_geo_map_page_navigation.test.ts",
    "lib/drug_intelligence/__tests__/drug_geo_time_trend.test.ts",
    "lib/drug_intelligence/__tests__/di_search_center_1b2_ux.test.ts",
    "lib/drug_intelligence/__tests__/di_relationship_investigation_1c.test.ts",
    "lib/drug_intelligence/__tests__/drug_network_graph_service.test.ts",
  ];
  for (const file of files) {
    assert.equal(existsSync(join(ROOT, file)), true, `missing regression file ${file}`);
  }
});

test("no new Commander API endpoint was added for layout", () => {
  const handlers = readFileSync(join(ROOT, "lib/drug_intelligence/drug_commander_api_handlers.ts"), "utf8");
  assert.doesNotMatch(handlers, /attention|command\/attention/);
  const page = readFileSync(join(ROOT, "app/drug-intelligence/command/page.tsx"), "utf8");
  assert.match(page, /useCommanderOverview/);
  assert.match(page, /useCommanderDecision/);
  assert.match(page, /buildCommanderAttentionItems/);
});
