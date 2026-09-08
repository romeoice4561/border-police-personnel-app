import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const centerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_reporting_center.tsx"), "utf8");
const landingSrc = readFileSync(join(ROOT, "app/drug-intelligence/page.tsx"), "utf8");
const shellSrc = readFileSync(join(ROOT, "components/layout/app_shell.tsx"), "utf8");
const personsDrawerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_list_export_drawer.tsx"), "utf8");
const caseDrawerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_case_report_drawer.tsx"), "utf8");
const personReportSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_person_report_drawer.tsx"), "utf8");
const historyHandlerSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_export_history_api_handlers.ts"), "utf8");
const historyProjSrc = readFileSync(join(ROOT, "lib/drug_intelligence/drug_export_history.ts"), "utf8");
const repoSrc = readFileSync(join(ROOT, "lib/database/repositories/drug_audit_log_repository.ts"), "utf8");

test("landing adds permission-aware reports entry and sidebar stays unchanged", () => {
  assert.match(landingSrc, /can\("drug.export"\)/);
  assert.match(landingSrc, /\/drug-intelligence\/reports/);
  assert.match(landingSrc, /di\.reports\.title/);
  assert.match(landingSrc, /data-testid="landing-reports-link"/);
  assert.doesNotMatch(shellSrc, /\/drug-intelligence\/reports/);
});

test("center catalogs live reports and exports without a second generator", () => {
  assert.match(centerSrc, /data-testid="report-card-commander"/);
  assert.match(centerSrc, /data-testid="report-card-case"/);
  assert.match(centerSrc, /data-testid="report-card-person"/);
  assert.match(centerSrc, /data-testid="report-card-board"/);
  assert.match(centerSrc, /data-testid="export-card-cases"/);
  assert.match(centerSrc, /data-testid="export-card-persons"/);
  assert.match(centerSrc, /DrugCaseReportDrawer/);
  assert.match(centerSrc, /DrugPersonReportDrawer/);
  assert.match(centerSrc, /DrugCaseListExportDrawer/);
  assert.match(centerSrc, /DrugPersonListExportDrawer/);
  assert.match(centerSrc, /\/drug-intelligence\/command/);
  assert.match(centerSrc, /\/drug-intelligence\/network/);
  assert.doesNotMatch(centerSrc, /buildDrugCaseReportV1|buildDrugPersonReportV1|getGeoResult|findAll/);
  assert.doesNotMatch(centerSrc, /mergePersons|Person A|Person F/);
});

test("coming soon tiles cannot generate MAP_DATA or OPERATIONAL_ALERTS", () => {
  assert.match(centerSrc, /data-testid="coming-soon-map"/);
  assert.match(centerSrc, /data-testid="coming-soon-alerts"/);
  assert.match(centerSrc, /di\.reports\.notReady/);
  assert.doesNotMatch(centerSrc, /MAP_DATA|OPERATIONAL_ALERTS/);
  assert.doesNotMatch(centerSrc, /Number\.MAX_SAFE_INTEGER/);
});

test("history UI uses operational labels and has no re-download", () => {
  assert.match(centerSrc, /data-testid="export-history"/);
  assert.match(centerSrc, /di\.reports\.kindCase/);
  assert.match(centerSrc, /di\.reports\.formatPrint/);
  assert.doesNotMatch(centerSrc, /CASE_REPORT|PERSON_DATA|HTML_PRINT|OPERATIONAL_PERSONS/);
  assert.doesNotMatch(centerSrc, /ดาวน์โหลดอีกครั้ง|re-download|download again/i);
});

test("persons CSV drawer previews OPERATIONAL_PERSONS and does not invent advanced filters", () => {
  assert.match(personsDrawerSrc, /OPERATIONAL_PERSONS/);
  assert.match(personsDrawerSrc, /previewExport/);
  assert.match(personsDrawerSrc, /downloadExport/);
  assert.match(personsDrawerSrc, /di\.reports\.personsCsvScopeAllActive/);
  assert.doesNotMatch(personsDrawerSrc, /ส่งออกผลการค้นหาปัจจุบัน/);
  assert.doesNotMatch(personsDrawerSrc, /MAX_SAFE_INTEGER/);
});

test("existing HTML print helper remains on case and person report drawers", () => {
  assert.match(caseDrawerSrc, /openHtmlPrintReport/);
  assert.match(caseDrawerSrc, /htmlPrintFailureMessage/);
  assert.match(personReportSrc, /openHtmlPrintReport/);
  assert.match(personReportSrc, /htmlPrintFailureMessage/);
  assert.doesNotMatch(caseDrawerSrc, /t\("di\.export\.downloadFailed"\)/);
  assert.doesNotMatch(personReportSrc, /t\("di\.export\.downloadFailed"\)/);
});

test("history API and repository stay actor-scoped and bounded", () => {
  assert.match(repoSrc, /recentExportsForActor/);
  assert.match(repoSrc, /take: limited|Math\.min\(50/);
  assert.match(repoSrc, /action: "export_created"/);
  assert.match(historyHandlerSrc, /requireDrugExport/);
  assert.match(historyHandlerSrc, /projectExportHistoryItems/);
  assert.match(historyProjSrc, /searchQuery/);
  assert.match(historyProjSrc, /exportType/);
  assert.match(historyProjSrc, /recordCount/);
  assert.doesNotMatch(historyHandlerSrc, /forActorId|allActors|adminSeeAll/);
});
