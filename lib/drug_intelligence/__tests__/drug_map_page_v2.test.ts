/**
 * DI-10E.6B — live Map page / popup / list source contracts.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());
const page = readFileSync(join(ROOT, "app/drug-intelligence/map/page.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const popup = readFileSync(join(ROOT, "components/drug_intelligence/drug_geo_marker_popup.tsx"), "utf8");
const list = readFileSync(join(ROOT, "components/drug_intelligence/drug_geo_result_list.tsx"), "utf8");
const province = readFileSync(join(ROOT, "components/drug_intelligence/drug_geo_province_breakdown.tsx"), "utf8");

test("page uses V2 query dates and local list pagination", () => {
  assert.match(page, /dateFrom: state\.dateFrom/);
  assert.match(page, /listPage/);
  assert.match(page, /page: listPage/);
  assert.match(page, /MAP_LIST_DEFAULT_PAGE_SIZE/);
  assert.doesNotMatch(page, /arrestDateFrom: state\.dateFrom/);
  assert.doesNotMatch(page, /caseId: state\.caseId/);
});

test("page distinguishes empty, soft limit, and hard limit", () => {
  assert.match(page, /map-empty-result/);
  assert.match(page, /map-marker-soft-limit/);
  assert.match(page, /map-marker-hard-limit/);
  assert.match(page, /map-hard-limit-pane/);
  assert.match(page, /di\.map\.emptyNoMatch/);
  assert.match(page, /di\.map\.emptyNoCoordinates/);
  assert.match(page, /di\.map\.emptyNoTimeData/);
  assert.match(page, /di\.map\.markerHardLimit/);
  assert.match(page, /DrugGeoTemporalSummary/);
  assert.match(page, /weekdays/);
  assert.match(page, /timePreset/);
});

test("page does not render misleading deferred analytics", () => {
  assert.doesNotMatch(page, /computeDrugGeoDefendantCount/);
  assert.doesNotMatch(page, /computeDrugGeoUnitCount/);
  assert.doesNotMatch(page, /combineDrugGeoSeizureGroups/);
  assert.doesNotMatch(page, /computeDrugGeoMonthlyTrend/);
  assert.doesNotMatch(page, /DrugGeoSeizureSummaryPanel/);
  assert.doesNotMatch(page, /DrugGeoTimeTrendChart/);
  assert.doesNotMatch(page, /kpiDefendantCount/);
  assert.doesNotMatch(page, /kpiUnitCount/);
});

test("page keeps report action, returnTo, and caseId as selection only", () => {
  assert.match(page, /DrugGeoReportDrawer/);
  assert.match(page, /inboundReturnTo/);
  assert.match(page, /filters\.caseId/);
  assert.match(page, /window\.location\.assign\(/);
  assert.doesNotMatch(page, /router\.push\(/);
});

test("page lazy-loads detail only for a selected marker that exists on the map", () => {
  assert.match(page, /useDrugMapCaseDetail/);
  assert.match(page, /detailCaseId/);
  assert.match(page, /geoQuery\.data\?\.markers\.some/);
  assert.doesNotMatch(page, /fetchDrugMapCaseDetail\(actorId, marker\.caseId\)/);
  assert.doesNotMatch(page, /onMouseEnter[\s\S]{0,80}useDrugMapCaseDetail/);
  assert.doesNotMatch(page, /onMouseEnter[\s\S]{0,80}detailCaseId/);
});

test("popup keeps lightweight fields and case navigation; drops relation-heavy sections", () => {
  assert.match(popup, /actionOpenCase/);
  assert.match(popup, /filterReportingUnit/);
  assert.match(popup, /popupLeadUnit/);
  assert.match(popup, /detailLoading/);
  assert.match(popup, /detailError/);
  assert.doesNotMatch(popup, /personSummaries/);
  assert.doesNotMatch(popup, /suspectCount/);
  assert.doesNotMatch(popup, /hasUnreviewedAlert/);
  assert.doesNotMatch(popup, /DrugGeoPersonsDrawer/);
  assert.match(popup, /persons\.items\.length > 0/);
  assert.match(popup, /seizures\.items\.length > 0/);
  assert.match(popup, /participatingUnits\.items\.length > 0/);
  assert.match(popup, /officers\.count > 0/);
  assert.match(popup, /max-h-80/);
  assert.match(popup, /map-detail-loading/);
  assert.match(popup, /map-detail-error/);
  assert.match(popup, /detail\.retry/);
});

test("list uses V2 rows, reporting/lead labels, and pagination controls", () => {
  assert.match(list, /reportingUnitText/);
  assert.match(list, /leadUnitText/);
  assert.match(list, /pagePrevious/);
  assert.match(list, /pageNext/);
  assert.doesNotMatch(list, /suspectCount/);
  assert.doesNotMatch(list, /seizedItems/);
});

test("province view uses server aggregates and does not click unknown bucket", () => {
  assert.match(province, /row\.unspecified/);
  assert.match(province, /withCoordinates/);
  assert.doesNotMatch(province, /personCount/);
  assert.doesNotMatch(province, /topSeizedItems/);
});

test("map detail i18n keys exist in Thai and English", () => {
  const dictionary = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");
  for (const key of [
    "di.map.detailLoading",
    "di.map.detailError",
    "di.map.detailRetry",
    "di.map.detailPersonsTitle",
    "di.map.detailSeizuresTitle",
    "di.map.detailUnitsTitle",
    "di.map.detailOfficersTitle",
    "di.map.detailTruncated",
  ]) {
    assert.match(dictionary, new RegExp(`"${key.replace(".", "\\.")}":\\s+tr\\("`));
  }
  assert.match(dictionary, /กำลังโหลดรายละเอียด\.\.\./);
  assert.match(dictionary, /ไม่สามารถโหลดรายละเอียดเพิ่มเติมได้/);
  assert.match(dictionary, /บุคคลที่เกี่ยวข้องในคดี/);
  assert.match(dictionary, /ของกลางที่บันทึกในคดี/);
  assert.match(dictionary, /หน่วยร่วมปฏิบัติ/);
  assert.match(dictionary, /เจ้าหน้าที่ในชุดจับกุม/);
});
