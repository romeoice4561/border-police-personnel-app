/**
 * DI-10E.5C — Geographic Intelligence Report builder + HTML renderer.
 *
 * Data comes only from DrugGeographicReportQueryService results.
 * Does not reuse the interactive Map loader or an unbounded page size.
 * MASKED and FULL both omit raw latitude/longitude.
 */

import { DRUG_CASE_STATUS_META, isValidDrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";
import type { ResolvedDrugExportContextV1 } from "@/lib/drug_intelligence/drug_export_context";
import type { DrugExportMaskingMode } from "@/lib/drug_intelligence/drug_export_types";
import {
  DRUG_CATEGORY_LABELS,
  DRUG_MEASUREMENT_KIND_LABELS,
} from "@/lib/drug_intelligence/drug_seized_item_options";
import type {
  GeographicReportAreaRankRow,
  GeographicReportCaseRow,
  GeographicReportQueryResult,
  GeographicReportSeizureGroup,
  GeographicReportTrendBucket,
  GeographicReportWarningCode,
} from "@/lib/drug_intelligence/drug_geographic_report_query";
import { escapeHtml } from "@/lib/export/html";
import { translate, type Language, type TranslationKey } from "@/lib/i18n/dictionary";

export const GEOGRAPHIC_REPORT_SCHEMA_VERSION = 1 as const;
export const GEOGRAPHIC_REPORT_SYSTEM_NAME = "BPPIS Drug Intelligence";

export const MAP_REPORT_SECTION_KEYS: Record<
  "scope" | "summary" | "coordinates" | "provinces" | "districts" | "seizures" | "trend" | "cases" | "noCoordinates" | "legend" | "methodology",
  TranslationKey
> = {
  scope: "di.export.geoSectionScope",
  summary: "di.export.geoSectionSummary",
  coordinates: "di.export.geoSectionCoords",
  provinces: "di.export.geoSectionProvinces",
  districts: "di.export.geoSectionDistricts",
  seizures: "di.export.geoSectionSeizures",
  trend: "di.export.geoSectionTrend",
  cases: "di.export.geoSectionCases",
  noCoordinates: "di.export.geoSectionNoCoords",
  legend: "di.export.geoSectionLegend",
  methodology: "di.export.geoSectionMethodology",
};

export interface DrugGeographicIntelligenceReportV1 {
  schemaVersion: 1;
  generatedAt: string;
  generatedBy: string;
  locale: Language;
  maskingMode: DrugExportMaskingMode;
  systemName: string;
  title: string;
  englishTitle: string;
  officialUse: string;
  scope: {
    periodLabel: string;
    fiscalYearLabel: string | null;
    reportingOrgLabel: string;
    leadOrgLabel: string;
    provinceLabel: string;
    districtLabel: string;
    statusLabel: string;
    categoryLabel: string;
    personFilterActive: boolean;
  };
  summary: {
    totalCases: number;
    casesWithCoordinates: number;
    casesWithoutCoordinates: number;
    distinctProvinceCount: number;
    distinctDistrictCount: number;
  };
  warnings: GeographicReportWarningCode[];
  warningMessages: string[];
  provinceRanking: GeographicReportAreaRankRow[];
  districtRanking: GeographicReportAreaRankRow[];
  seizureGroups: GeographicReportSeizureGroup[];
  monthlyTrend: GeographicReportTrendBucket[];
  cases: GeographicReportCaseRow[];
  noCoordinateCases: GeographicReportCaseRow[];
  truncation: GeographicReportQueryResult["truncation"];
  methodologyNotes: string[];
  legend: Array<{ kind: string; label: string }>;
}

function t(locale: Language, key: TranslationKey): string {
  return translate(key, locale);
}

function formatCount(value: number, locale: Language): string {
  return value.toLocaleString(locale === "en" ? "en-US" : "th-TH");
}

function organizationLabel(
  locale: Language,
  org: { hqId?: number; regionId?: number; battalionId?: number; companyId?: number } | undefined,
  emptyKey: TranslationKey
): string {
  if (!org) return t(locale, emptyKey);
  const parts: string[] = [];
  if (org.hqId != null) parts.push(`${t(locale, "di.command.filterHq")} ${org.hqId}`);
  if (org.regionId != null) parts.push(`${t(locale, "di.command.filterRegion")} ${org.regionId}`);
  if (org.battalionId != null) parts.push(`${t(locale, "di.command.filterBattalion")} ${org.battalionId}`);
  if (org.companyId != null) parts.push(`${t(locale, "di.command.filterCompany")} ${org.companyId}`);
  return parts.length > 0 ? parts.join(" · ") : t(locale, emptyKey);
}

function periodLabel(result: GeographicReportQueryResult, locale: Language): string {
  const period = result.effectivePeriod;
  if (period.dateFrom && period.dateTo) return `${period.dateFrom} – ${period.dateTo}`;
  return t(locale, "di.export.geoUnrestrictedPeriod");
}

function fiscalYearLabel(result: GeographicReportQueryResult, locale: Language): string | null {
  const period = result.effectivePeriod;
  if (period.source === "FISCAL_YEAR" && period.appliedFiscalYearBe != null) {
    return `${t(locale, "di.export.appliedFiscalYear")} ${period.appliedFiscalYearBe}`;
  }
  if (period.source === "EXPLICIT_DATES") return t(locale, "di.export.explicitDates");
  return null;
}

function warningMessage(code: GeographicReportWarningCode, locale: Language): string {
  const keys: Record<GeographicReportWarningCode, TranslationKey> = {
    SOFT_LIMIT: "di.export.softLimitWarning",
    CASE_LIST_TRUNCATED: "di.export.geoCaseListTruncated",
    NO_COORDINATE_LIST_TRUNCATED: "di.export.geoNoCoordListTruncated",
    PROVINCE_RANKING_TRUNCATED: "di.export.geoProvinceTruncated",
    DISTRICT_RANKING_TRUNCATED: "di.export.geoDistrictTruncated",
    TREND_CLAMPED: "di.export.geoTrendClamped",
  };
  return t(locale, keys[code]);
}

function statusLabel(value: string | undefined, locale: Language, emptyKey: TranslationKey): string {
  if (!value) return t(locale, emptyKey);
  if (!isValidDrugCaseStatus(value)) return value;
  const meta = DRUG_CASE_STATUS_META[value];
  return locale === "en" ? meta.labelEn : meta.labelTh;
}

function categoryLabel(value: string | undefined, locale: Language, emptyKey: TranslationKey): string {
  if (!value || !(value in DRUG_CATEGORY_LABELS)) return value ? value : t(locale, emptyKey);
  const labels = DRUG_CATEGORY_LABELS[value as keyof typeof DRUG_CATEGORY_LABELS];
  return locale === "en" ? labels.labelEn : labels.labelTh;
}

export function geographicReportRecordCount(report: DrugGeographicIntelligenceReportV1): number {
  return report.summary.totalCases;
}

export function buildDrugGeographicIntelligenceReport(
  query: GeographicReportQueryResult,
  input: {
    locale: Language;
    generatedAt: string;
    generatedBy: string;
    maskingMode: DrugExportMaskingMode;
    context?: ResolvedDrugExportContextV1;
  }
): DrugGeographicIntelligenceReportV1 {
  const locale = input.locale;
  const warningMessages = query.warnings.map((code) => warningMessage(code, locale));
  return {
    schemaVersion: GEOGRAPHIC_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    locale,
    maskingMode: input.maskingMode,
    systemName: GEOGRAPHIC_REPORT_SYSTEM_NAME,
    title: t(locale, "di.export.geographicReportTitle"),
    englishTitle: t(locale, "di.export.geographicReportEnglishTitle"),
    officialUse: t(locale, "di.export.officialUse"),
    scope: {
      periodLabel: periodLabel(query, locale),
      fiscalYearLabel: fiscalYearLabel(query, locale),
      reportingOrgLabel: organizationLabel(locale, input.context?.organization, "di.command.scopeAllReportingUnits"),
      leadOrgLabel: organizationLabel(locale, input.context?.leadOrganization, "di.export.geoLeadOrgAll"),
      provinceLabel: query.filters.province?.trim() || t(locale, "di.command.scopeAllProvinces"),
      districtLabel: query.filters.district?.trim() || t(locale, "di.export.geoAllDistricts"),
      statusLabel: statusLabel(query.filters.status, locale, "di.export.geoAllStatuses"),
      categoryLabel: categoryLabel(query.filters.drugCategory, locale, "di.export.geoAllCategories"),
      personFilterActive: Boolean(query.filters.personId),
    },
    summary: query.summary,
    warnings: query.warnings,
    warningMessages,
    provinceRanking: query.provinceRanking,
    districtRanking: query.districtRanking,
    seizureGroups: query.seizureGroups,
    monthlyTrend: query.monthlyTrend,
    cases: query.cases,
    noCoordinateCases: query.noCoordinateCases,
    truncation: query.truncation,
    methodologyNotes: [
      t(locale, "di.export.geoMethodologySource"),
      t(locale, "di.export.geoMethodologyLocation"),
      t(locale, "di.export.geoMethodologyArea"),
      t(locale, "di.export.geoMethodologyGuilt"),
      t(locale, "di.export.geoMethodologyCountMass"),
      t(locale, "di.export.geoMethodologyNotRisk"),
    ],
    legend: [
      { kind: "FACT / DIRECT", label: t(locale, "di.export.geoLegendFact") },
      { kind: "ANALYTIC SUMMARY", label: t(locale, "di.export.geoLegendAnalytic") },
      { kind: "QUERY CONDITION", label: t(locale, "di.export.geoLegendQuery") },
    ],
  };
}

function dash(value: string): string {
  return value.trim() ? escapeHtml(value) : "—";
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  return `<table><thead><tr>${headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function empty(locale: Language): string {
  return `<p class="empty">${escapeHtml(t(locale, "di.export.noData"))}</p>`;
}

function areaLabel(row: GeographicReportAreaRankRow, unspecified: string): string {
  return row.unspecified || !row.value ? unspecified : row.value;
}

function seizureAmount(group: GeographicReportSeizureGroup, locale: Language): string {
  if (group.measurementKind === "COUNT") {
    return group.totalCount == null ? "—" : formatCount(group.totalCount, locale);
  }
  return group.totalWeightGrams == null ? "—" : formatCount(group.totalWeightGrams, locale);
}

function seizureUnit(group: GeographicReportSeizureGroup, locale: Language): string {
  if (group.measurementKind === "COUNT") return group.displayUnit?.trim() || "—";
  return locale === "en" ? "g" : "กรัม";
}

function caseCoordLabel(hasCoordinates: boolean, locale: Language): string {
  return hasCoordinates ? t(locale, "di.export.geoHasCoordinates") : t(locale, "di.export.geoNoCoordinates");
}

function caseStatusLabel(status: string, locale: Language): string {
  return statusLabel(status, locale, "di.export.geoAllStatuses") === t(locale, "di.export.geoAllStatuses")
    ? status
    : statusLabel(status, locale, "di.export.geoAllStatuses");
}

export function renderDrugGeographicIntelligenceReportHtml(report: DrugGeographicIntelligenceReportV1): string {
  const locale = report.locale;
  const maxTrend = report.monthlyTrend.reduce((max, row) => Math.max(max, row.caseCount), 0);
  const maxProvince = report.provinceRanking.reduce((max, row) => Math.max(max, row.caseCount), 0);
  const maxDistrict = report.districtRanking.reduce((max, row) => Math.max(max, row.caseCount), 0);

  const kpiRows = [
    [dash(t(locale, "di.export.geoKpiTotal")), dash(formatCount(report.summary.totalCases, locale))],
    [dash(t(locale, "di.export.geoKpiWithCoords")), dash(formatCount(report.summary.casesWithCoordinates, locale))],
    [dash(t(locale, "di.export.geoKpiWithoutCoords")), dash(formatCount(report.summary.casesWithoutCoordinates, locale))],
    [dash(t(locale, "di.export.geoKpiProvinces")), dash(formatCount(report.summary.distinctProvinceCount, locale))],
    [dash(t(locale, "di.export.geoKpiDistricts")), dash(formatCount(report.summary.distinctDistrictCount, locale))],
  ];

  const provinceRows = report.provinceRanking.map((row, index) => {
    const pct = maxProvince > 0 ? Math.round((row.caseCount / maxProvince) * 100) : 0;
    return [
      dash(String(index + 1)),
      dash(areaLabel(row, t(locale, "di.export.geoProvinceUnspecified"))),
      dash(formatCount(row.caseCount, locale)),
      `<div class="bar" role="img" aria-label="${escapeHtml(formatCount(row.caseCount, locale))}"><span class="bar-fill" style="width:${pct}%"></span></div>`,
    ];
  });

  const districtRows = report.districtRanking.map((row, index) => {
    const pct = maxDistrict > 0 ? Math.round((row.caseCount / maxDistrict) * 100) : 0;
    return [
      dash(String(index + 1)),
      dash(areaLabel(row, t(locale, "di.export.geoDistrictUnspecified"))),
      dash(formatCount(row.caseCount, locale)),
      `<div class="bar" role="img" aria-label="${escapeHtml(formatCount(row.caseCount, locale))}"><span class="bar-fill" style="width:${pct}%"></span></div>`,
    ];
  });

  const seizureRows = report.seizureGroups.map((group) => [
    dash(categoryLabel(group.drugCategory, locale, "di.export.geoAllCategories")),
    dash(locale === "en" ? DRUG_MEASUREMENT_KIND_LABELS[group.measurementKind].labelEn : DRUG_MEASUREMENT_KIND_LABELS[group.measurementKind].labelTh),
    dash(seizureAmount(group, locale)),
    dash(seizureUnit(group, locale)),
  ]);

  const trendRows = report.monthlyTrend.map((row) => {
    const pct = maxTrend > 0 ? Math.round((row.caseCount / maxTrend) * 100) : 0;
    return [
      dash(row.monthKey),
      dash(formatCount(row.caseCount, locale)),
      `<div class="bar" role="img" aria-label="${escapeHtml(`${row.monthKey}: ${formatCount(row.caseCount, locale)}`)}"><span class="bar-fill" style="width:${pct}%"></span></div>`,
    ];
  });

  const caseRows = report.cases.map((row, index) => [
    dash(String(index + 1)),
    dash(row.caseNumber),
    dash(row.arrestDate ?? ""),
    dash(row.province ?? ""),
    dash(row.district ?? ""),
    dash(row.locationName ?? ""),
    dash(row.reportingUnitText ?? ""),
    dash(row.leadUnitText ?? ""),
    dash(caseStatusLabel(row.status, locale)),
    dash(caseCoordLabel(row.hasCoordinates, locale)),
  ]);

  const noCoordRows = report.noCoordinateCases.map((row, index) => [
    dash(String(index + 1)),
    dash(row.caseNumber),
    dash(row.arrestDate ?? ""),
    dash(row.province ?? ""),
    dash(row.district ?? ""),
    dash(row.locationName ?? ""),
    dash(row.reportingUnitText ?? ""),
    dash(row.leadUnitText ?? ""),
    dash(caseStatusLabel(row.status, locale)),
  ]);

  const legendRows = report.legend.map((row) => [dash(row.kind), dash(row.label)]);
  const warningBlock =
    report.warningMessages.length > 0
      ? `<ul>${report.warningMessages.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
      : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(report.title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; @bottom-right { content: counter(page); } }
  body { font-family: "Sarabun", "Noto Sans Thai", "Thonburi", "Leelawadee UI", "Segoe UI", Tahoma, sans-serif; color: #111; font-size: 12px; line-height: 1.45; margin: 0; }
  header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
  .kicker { font-size: 11px; margin: 0 0 4px; letter-spacing: 0.02em; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .subtitle { font-size: 12px; letter-spacing: 0.06em; margin: 0 0 8px; }
  h2 { font-size: 13px; margin: 18px 0 8px; page-break-after: avoid; }
  .meta, footer, .note { color: #333; font-size: 11px; }
  section { page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f3f3f3; font-weight: 600; }
  ul { margin: 0 0 8px; padding-left: 18px; }
  .empty { color: #555; margin: 0 0 8px; }
  .bar { background: #eee; height: 8px; min-width: 48px; }
  .bar-fill { display: block; background: #333; height: 8px; }
  footer { border-top: 1px solid #111; margin-top: 24px; padding-top: 8px; }
  @media print { header, h2 { page-break-after: avoid; } }
</style>
</head>
<body>
<header>
  <p class="kicker">${escapeHtml(report.systemName)}</p>
  <h1>${escapeHtml(report.title)}</h1>
  <p class="subtitle">${escapeHtml(report.englishTitle)}</p>
  <p class="meta">${escapeHtml(report.officialUse)} · ${escapeHtml(report.maskingMode === "FULL" ? t(locale, "di.export.full") : t(locale, "di.export.masked"))}</p>
  <p class="meta">${escapeHtml(t(locale, "di.export.generatedAt"))}: ${escapeHtml(report.generatedAt)}</p>
  <p class="meta">${escapeHtml(t(locale, "di.export.generatedBy"))}: ${dash(report.generatedBy)}</p>
</header>
<section>
  <h2>1. ${escapeHtml(t(locale, "di.export.geoSectionScope"))}</h2>
  <table>
    <tbody>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.periodScope"))}</th><td>${dash(report.scope.periodLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.appliedFiscalYear"))}</th><td>${dash(report.scope.fiscalYearLabel ?? t(locale, "di.export.geoUnrestrictedPeriod"))}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.organizationScope"))}</th><td>${dash(report.scope.reportingOrgLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.geoLeadOrgScope"))}</th><td>${dash(report.scope.leadOrgLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.provinceScope"))}</th><td>${dash(report.scope.provinceLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.geoDistrictScope"))}</th><td>${dash(report.scope.districtLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.geoStatusScope"))}</th><td>${dash(report.scope.statusLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.geoCategoryScope"))}</th><td>${dash(report.scope.categoryLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.geoPersonScope"))}</th><td>${dash(report.scope.personFilterActive ? t(locale, "di.export.geoPersonFilterActive") : t(locale, "di.export.geoPersonFilterNone"))}</td></tr>
    </tbody>
  </table>
</section>
<section>
  <h2>2. ${escapeHtml(t(locale, "di.export.geoSectionSummary"))}</h2>
  ${table([t(locale, "di.export.indicator"), t(locale, "di.export.records")], kpiRows)}
  ${warningBlock}
</section>
<section>
  <h2>3. ${escapeHtml(t(locale, "di.export.geoSectionCoords"))}</h2>
  <p class="note">${escapeHtml(t(locale, "di.export.geoCoordNote"))}</p>
  ${table(
    [t(locale, "di.export.indicator"), t(locale, "di.export.records")],
    [
      [dash(t(locale, "di.export.geoKpiTotal")), dash(formatCount(report.summary.totalCases, locale))],
      [dash(t(locale, "di.export.geoKpiWithCoords")), dash(formatCount(report.summary.casesWithCoordinates, locale))],
      [dash(t(locale, "di.export.geoKpiWithoutCoords")), dash(formatCount(report.summary.casesWithoutCoordinates, locale))],
    ]
  )}
</section>
<section>
  <h2>4. ${escapeHtml(t(locale, "di.export.geoProvinceRanking"))}</h2>
  ${provinceRows.length ? table([t(locale, "di.export.rank"), t(locale, "di.export.geoColProvince"), t(locale, "di.command.areasColCases"), t(locale, "di.export.barEquivalent")], provinceRows) : empty(locale)}
  ${report.truncation.provinceRanking ? `<p class="note">${escapeHtml(t(locale, "di.export.geoProvinceTruncated"))}</p>` : ""}
</section>
<section>
  <h2>5. ${escapeHtml(t(locale, "di.export.geoDistrictRanking"))}</h2>
  ${districtRows.length ? table([t(locale, "di.export.rank"), t(locale, "di.export.geoColDistrict"), t(locale, "di.command.areasColCases"), t(locale, "di.export.barEquivalent")], districtRows) : empty(locale)}
  ${report.truncation.districtRanking ? `<p class="note">${escapeHtml(t(locale, "di.export.geoDistrictTruncated"))}</p>` : ""}
</section>
<section>
  <h2>6. ${escapeHtml(t(locale, "di.export.geoSectionSeizures"))}</h2>
  ${seizureRows.length ? table([t(locale, "di.export.category"), t(locale, "di.export.measurementKind"), t(locale, "di.export.currentValue"), t(locale, "di.export.geoDisplayUnit")], seizureRows) : empty(locale)}
  <p class="note">${escapeHtml(t(locale, "di.export.geoMethodologyCountMass"))}</p>
</section>
<section>
  <h2>7. ${escapeHtml(t(locale, "di.export.geoSectionTrend"))}</h2>
  ${trendRows.length ? table([t(locale, "di.export.month"), t(locale, "di.command.areasColCases"), t(locale, "di.export.barEquivalent")], trendRows) : empty(locale)}
  ${report.truncation.monthlyTrend ? `<p class="note">${escapeHtml(t(locale, "di.export.geoTrendClamped"))}</p>` : ""}
</section>
<section>
  <h2>8. ${escapeHtml(t(locale, "di.export.geoSectionCases"))}</h2>
  ${
    caseRows.length
      ? table(
          [
            t(locale, "di.export.rank"),
            t(locale, "di.export.geoColCaseNumber"),
            t(locale, "di.export.geoColArrestDate"),
            t(locale, "di.export.geoColProvince"),
            t(locale, "di.export.geoColDistrict"),
            t(locale, "di.export.geoColLocation"),
            t(locale, "di.export.geoColReporting"),
            t(locale, "di.export.geoColLead"),
            t(locale, "di.export.geoColStatus"),
            t(locale, "di.export.geoColCoords"),
          ],
          caseRows
        )
      : empty(locale)
  }
  ${report.truncation.cases ? `<p class="note">${escapeHtml(t(locale, "di.export.geoCaseListTruncated"))}</p>` : ""}
</section>
<section>
  <h2>9. ${escapeHtml(t(locale, "di.export.geoSectionNoCoords"))}</h2>
  <p class="note">${escapeHtml(t(locale, "di.export.geoCoordNote"))}</p>
  ${
    noCoordRows.length
      ? table(
          [
            t(locale, "di.export.rank"),
            t(locale, "di.export.geoColCaseNumber"),
            t(locale, "di.export.geoColArrestDate"),
            t(locale, "di.export.geoColProvince"),
            t(locale, "di.export.geoColDistrict"),
            t(locale, "di.export.geoColLocation"),
            t(locale, "di.export.geoColReporting"),
            t(locale, "di.export.geoColLead"),
            t(locale, "di.export.geoColStatus"),
          ],
          noCoordRows
        )
      : empty(locale)
  }
  ${report.truncation.noCoordinateCases ? `<p class="note">${escapeHtml(t(locale, "di.export.geoNoCoordListTruncated"))}</p>` : ""}
</section>
<section>
  <h2>10. ${escapeHtml(t(locale, "di.export.geoSectionLegend"))}</h2>
  ${table([t(locale, "di.export.geoLegendKind"), t(locale, "di.export.indicator")], legendRows)}
</section>
<section>
  <h2>11. ${escapeHtml(t(locale, "di.export.geoSectionMethodology"))}</h2>
  <ul>${report.methodologyNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
</section>
<footer>
  <p>${escapeHtml(t(locale, "di.export.generatedBy"))}: ${dash(report.generatedBy)}</p>
  <p>${escapeHtml(t(locale, "di.export.generatedAt"))}: ${escapeHtml(report.generatedAt)}</p>
  <p>${escapeHtml(report.systemName)} · ${escapeHtml(report.officialUse)}</p>
</footer>
</body>
</html>`;
}
