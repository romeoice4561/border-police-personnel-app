/**
 * Commander Report V1 — executive aggregates from Commander Dashboard services.
 * Deterministic templates only. No AI narrative, no risk score, no PII.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { buildCommanderAttentionItems } from "@/lib/drug_intelligence/drug_commander_attention";
import {
  buildCommanderSituationObservations,
  commanderSeizureDisplayUnit,
  compareCommanderMetric,
  compareCommanderSeizures,
  formatCommanderPercent,
  type CommanderMetricDelta,
} from "@/lib/drug_intelligence/drug_commander_comparison";
import { DrugCommanderDashboardService } from "@/lib/drug_intelligence/drug_commander_dashboard_service";
import {
  resolveCommanderDashboardScope,
  toCommanderIsoDate,
} from "@/lib/drug_intelligence/drug_commander_filter";
import { commanderMonthLabel } from "@/lib/drug_intelligence/drug_commander_trend_labels";
import type { ResolvedDrugExportContextV1 } from "@/lib/drug_intelligence/drug_export_context";
import { exportContextToCommanderFilter } from "@/lib/drug_intelligence/drug_export_commander_context";
import { escapeHtml } from "@/lib/export/html";
import { translate, type Language, type TranslationKey } from "@/lib/i18n/dictionary";

export const COMMANDER_REPORT_SCHEMA_VERSION = 1 as const;
export const COMMANDER_REPORT_SYSTEM_NAME = "BPPIS Drug Intelligence";

export type CommanderReportPeriodSource = "EXPLICIT_DATES" | "FISCAL_YEAR";

export interface DrugCommanderReportKpiV1 {
  id: "cases" | "arrested" | "alerts" | "duplicates";
  label: string;
  current: number;
  previous: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  direction: "up" | "down" | "same" | null;
  scope: "period" | "queue";
}

export interface DrugCommanderReportSeizureV1 {
  drugCategory: string;
  label: string;
  measurementKind: "COUNT" | "MASS";
  value: number;
  displayUnit: string;
  previousValue: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
}

export interface DrugCommanderReportTrendBucketV1 {
  monthKey: string;
  label: string;
  caseCount: number;
  barPercent: number;
}

export interface DrugCommanderReportAreaV1 {
  rank: number;
  province: string;
  caseCount: number;
  previousCaseCount: number | null;
}

export interface DrugCommanderReportAttentionV1 {
  id: string;
  group: "review" | "complete";
  label: string;
  count: number;
  queueScope: boolean;
}

export interface DrugCommanderReportV1 {
  schemaVersion: 1;
  generatedAt: string;
  generatedBy: string;
  locale: Language;
  maskingMode: "MASKED";
  systemName: string;
  scope: {
    periodFrom: string;
    periodTo: string;
    fiscalYearBe: number | null;
    periodSource: CommanderReportPeriodSource;
    organization: {
      hqId: number | null;
      regionId: number | null;
      battalionId: number | null;
      companyId: number | null;
      label: string;
    };
    province: string | null;
    provinceLabel: string;
    status: string | null;
  };
  comparisonScope: {
    kind: "previous-fy" | "previous-window";
    from: string;
    to: string;
    fiscalYearBe: number | null;
    label: string;
  };
  executiveSummary: string[];
  kpis: DrugCommanderReportKpiV1[];
  seizures: DrugCommanderReportSeizureV1[];
  trend: DrugCommanderReportTrendBucketV1[];
  areas: DrugCommanderReportAreaV1[];
  units: {
    groupBy: string;
    rows: Array<{
      unitId: number | null;
      unitLabel: string;
      caseCount: number;
      arrestedPersonCount: number;
      methTabletCount: number | null;
      iceCrystalKg: number | null;
    }>;
    assignedCaseCount: number;
    unassignedCaseCount: number;
  };
  attentionItems: DrugCommanderReportAttentionV1[];
  dataReadiness: {
    totalCases: number;
    casesMissingReportingUnit: number;
    casesMissingCoordinates: number;
    casesMissingArrested: number;
    casesWithIncompleteSeizureCategory: number;
  };
  methodologyNotes: string[];
}

function t(locale: Language, key: TranslationKey): string {
  return translate(key, locale);
}

function formatCount(value: number, locale: Language): string {
  if (!Number.isFinite(value)) return locale === "en" ? "No data" : "ไม่มีข้อมูล";
  return value.toLocaleString(locale === "en" ? "en-US" : "th-TH");
}

function periodKpi(
  id: DrugCommanderReportKpiV1["id"],
  label: string,
  current: number,
  previous: number
): DrugCommanderReportKpiV1 {
  const delta = compareCommanderMetric(current, previous);
  return {
    id,
    label,
    current,
    previous,
    absoluteChange: delta.absoluteChange,
    percentChange: delta.percentChange,
    direction: delta.direction,
    scope: "period",
  };
}

function queueKpi(id: DrugCommanderReportKpiV1["id"], label: string, current: number): DrugCommanderReportKpiV1 {
  return {
    id,
    label,
    current,
    previous: null,
    absoluteChange: null,
    percentChange: null,
    direction: null,
    scope: "queue",
  };
}

function organizationLabel(
  locale: Language,
  org: {
    hqId?: number;
    regionId?: number;
    battalionId?: number;
    companyId?: number;
  }
): string {
  const parts: string[] = [];
  if (org.hqId != null) parts.push(`${t(locale, "di.command.filterHq")} ${org.hqId}`);
  if (org.regionId != null) parts.push(`${t(locale, "di.command.filterRegion")} ${org.regionId}`);
  if (org.battalionId != null) parts.push(`${t(locale, "di.command.filterBattalion")} ${org.battalionId}`);
  if (org.companyId != null) parts.push(`${t(locale, "di.command.filterCompany")} ${org.companyId}`);
  return parts.length > 0 ? parts.join(" · ") : t(locale, "di.command.scopeAllReportingUnits");
}

function arrestedSummaryLine(count: number, locale: Language): string {
  const n = formatCount(count, locale);
  return locale === "en"
    ? `Arrested/accused persons in the selected period: ${n}`
    : `จำนวนผู้ถูกจับ/ผู้ต้องหาในช่วงที่เลือก ${n} คน`;
}

function duplicateSummaryLine(count: number, locale: Language): string {
  const n = formatCount(count, locale);
  return locale === "en"
    ? `${n} possible duplicate person records are waiting for review`
    : `มีข้อมูลบุคคลที่อาจซ้ำ ${n} รายการรอตรวจสอบ`;
}

export async function buildDrugCommanderReportV1(
  db: DatabaseClient,
  input: {
    context: ResolvedDrugExportContextV1;
    generatedBy: string;
    actorId?: string;
  }
): Promise<DrugCommanderReportV1> {
  const locale = input.context.locale;
  const requested = exportContextToCommanderFilter(input.context);
  const filter = resolveCommanderDashboardScope({ id: input.actorId ?? input.context.actorId }, requested);
  const service = new DrugCommanderDashboardService(db);

  const [overview, seizures, trend, areas, units, , decision] = await Promise.all([
    service.getOverview(filter),
    service.getSeizures(filter),
    service.getTrend(filter),
    service.getAreas(filter),
    service.getUnits(filter),
    service.getSignals(),
    service.getDecision(filter),
  ]);

  const caseDelta = compareCommanderMetric(overview.caseCount, decision.previousCaseCount);
  const topCountSeizure = seizures.items
    .filter((item) => item.measurementKind === "COUNT" && (item.totalQuantity ?? 0) > 0)
    .slice()
    .sort((a, b) => (b.totalQuantity ?? 0) - (a.totalQuantity ?? 0))[0];

  const situation = buildCommanderSituationObservations({
    caseCount: overview.caseCount,
    caseDelta,
    topProvince: areas.rows[0],
    topCountSeizure: topCountSeizure
      ? {
          labelTh: topCountSeizure.labelTh,
          totalQuantity: topCountSeizure.totalQuantity ?? 0,
          displayUnit: topCountSeizure.displayUnit,
        }
      : undefined,
    newAlertsCount: overview.newAlertsCount,
    casesWithoutArrestedRoleCount: overview.casesWithoutArrestedRoleCount,
  });

  const executiveSummary = [
    ...situation.map((row) => (locale === "en" ? row.textEn : row.textTh)),
    arrestedSummaryLine(overview.arrestedPersonCount, locale),
  ];
  if (overview.pendingDuplicatesCount > 0) {
    executiveSummary.push(duplicateSummaryLine(overview.pendingDuplicatesCount, locale));
  }

  const seizureComparisons = compareCommanderSeizures(seizures.items, decision.previousSeizures);
  const maxTrend = Math.max(0, ...trend.buckets.map((bucket) => bucket.caseCount));
  const previousAreas = new Map(decision.previousAreas.map((row) => [row.province, row.caseCount]));

  const attention = buildCommanderAttentionItems({
    newAlertsCount: overview.newAlertsCount,
    pendingDuplicatesCount: overview.pendingDuplicatesCount,
    missingArrestedCount: overview.casesWithoutArrestedRoleCount,
    missingUnitCount: decision.readiness.casesMissingReportingUnit,
    missingCoordsCount: decision.readiness.casesMissingCoordinates,
    alertsHref: "/drug-intelligence/alerts",
    duplicatesHref: "/drug-intelligence/review/duplicates",
    missingArrestedHref: "/drug-intelligence/cases",
    missingUnitHref: "/drug-intelligence/cases",
    missingCoordsHref: "/drug-intelligence/cases",
  });

  return {
    schemaVersion: COMMANDER_REPORT_SCHEMA_VERSION,
    generatedAt: input.context.generatedAt,
    generatedBy: input.generatedBy,
    locale,
    maskingMode: "MASKED",
    systemName: COMMANDER_REPORT_SYSTEM_NAME,
    scope: {
      periodFrom: toCommanderIsoDate(filter.arrestDateFrom),
      periodTo: toCommanderIsoDate(filter.arrestDateTo),
      fiscalYearBe: filter.fiscalYearBe ?? null,
      periodSource: filter.fiscalYearBe != null ? "FISCAL_YEAR" : "EXPLICIT_DATES",
      organization: {
        hqId: filter.reportingHeadquartersId ?? null,
        regionId: filter.reportingRegionId ?? null,
        battalionId: filter.reportingBattalionId ?? null,
        companyId: filter.reportingCompanyId ?? null,
        label: organizationLabel(locale, {
          hqId: filter.reportingHeadquartersId,
          regionId: filter.reportingRegionId,
          battalionId: filter.reportingBattalionId,
          companyId: filter.reportingCompanyId,
        }),
      },
      province: filter.province ?? null,
      provinceLabel: filter.province ?? t(locale, "di.command.scopeAllProvinces"),
      status: filter.status ?? null,
    },
    comparisonScope: {
      kind: decision.comparisonPeriod.kind,
      from: decision.comparisonPeriod.from.slice(0, 10),
      to: decision.comparisonPeriod.to.slice(0, 10),
      fiscalYearBe: decision.comparisonPeriod.fiscalYearBe ?? null,
      label: locale === "en" ? decision.comparisonPeriod.labelEn : decision.comparisonPeriod.labelTh,
    },
    executiveSummary,
    kpis: [
      periodKpi("cases", t(locale, "di.command.kpiCases"), overview.caseCount, decision.previousCaseCount),
      periodKpi("arrested", t(locale, "di.command.kpiArrested"), overview.arrestedPersonCount, decision.previousArrestedPersonCount),
      queueKpi("alerts", t(locale, "di.command.kpiAlerts"), overview.newAlertsCount),
      queueKpi("duplicates", t(locale, "di.command.kpiDuplicates"), overview.pendingDuplicatesCount),
    ],
    seizures: seizureComparisons.map(({ item, delta }) => ({
      drugCategory: item.drugCategory,
      label: item.labelTh,
      measurementKind: item.measurementKind === "MASS" ? "MASS" : "COUNT",
      value: item.measurementKind === "MASS" ? (item.totalWeightKg ?? 0) : (item.totalQuantity ?? 0),
      displayUnit: commanderSeizureDisplayUnit(item.measurementKind, item.displayUnit, locale),
      previousValue: delta.previous,
      absoluteChange: delta.absoluteChange,
      percentChange: delta.percentChange,
    })),
    trend: trend.buckets.map((bucket) => ({
      monthKey: bucket.monthKey,
      label: `${commanderMonthLabel(bucket.month, locale)} ${bucket.year}`,
      caseCount: bucket.caseCount,
      barPercent: maxTrend > 0 ? Math.round((bucket.caseCount / maxTrend) * 100) : 0,
    })),
    areas: areas.rows.map((row, index) => ({
      rank: index + 1,
      province: row.province,
      caseCount: row.caseCount,
      previousCaseCount: previousAreas.has(row.province) ? (previousAreas.get(row.province) ?? 0) : null,
    })),
    units: {
      groupBy: units.groupBy,
      rows: units.rows.map((row) => ({
        unitId: row.unitId,
        unitLabel: row.unitLabel,
        caseCount: row.caseCount,
        arrestedPersonCount: row.arrestedPersonCount,
        methTabletCount: row.methTabletCount,
        iceCrystalKg: row.iceCrystalKg,
      })),
      assignedCaseCount: units.assignedCaseCount,
      unassignedCaseCount: units.unassignedCaseCount,
    },
    attentionItems: attention.map((item) => ({
      id: item.id,
      group: item.group,
      label: t(locale, item.labelKey),
      count: item.count,
      queueScope: item.queueScope,
    })),
    dataReadiness: {
      totalCases: decision.readiness.totalCases,
      casesMissingReportingUnit: decision.readiness.casesMissingReportingUnit,
      casesMissingCoordinates: decision.readiness.casesMissingCoordinates,
      casesMissingArrested: overview.casesWithoutArrestedRoleCount,
      casesWithIncompleteSeizureCategory: decision.readiness.casesWithIncompleteSeizureCategory,
    },
    methodologyNotes: [
      t(locale, "di.export.methodologySource"),
      t(locale, "di.export.methodologyScope"),
      t(locale, "di.export.methodologyComparison"),
      t(locale, "di.export.methodologyCountMass"),
      t(locale, "di.export.methodologyAttention"),
      t(locale, "di.export.notRiskScore"),
      t(locale, "di.export.notAiGenerated"),
      t(locale, "di.export.methodologyIncomplete"),
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

function formatDelta(delta: Pick<CommanderMetricDelta, "absoluteChange" | "percentChange" | "direction">, locale: Language): string {
  if (delta.direction === "same") return locale === "en" ? "unchanged" : "เท่าเดิม";
  const abs = formatCount(Math.abs(delta.absoluteChange), locale);
  const sign = delta.absoluteChange > 0 ? "+" : "−";
  return `${sign}${abs} (${formatCommanderPercent(delta.percentChange, locale)})`;
}

function kpiDeltaText(kpi: DrugCommanderReportKpiV1, locale: Language): string {
  if (kpi.scope === "queue" || kpi.previous == null || kpi.absoluteChange == null) {
    return t(locale, "di.command.kpiQueueBadge");
  }
  return formatDelta(
    { absoluteChange: kpi.absoluteChange, percentChange: kpi.percentChange, direction: kpi.direction ?? "same" },
    locale
  );
}

export function renderDrugCommanderReportHtml(report: DrugCommanderReportV1): string {
  const locale = report.locale;
  const official = t(locale, "di.export.officialUse");
  const fyLabel =
    report.scope.periodSource === "FISCAL_YEAR" && report.scope.fiscalYearBe != null
      ? `${t(locale, "di.export.appliedFiscalYear")} ${report.scope.fiscalYearBe}`
      : t(locale, "di.export.explicitDates");

  const kpiRows = report.kpis.map((kpi) => [
    dash(kpi.label),
    dash(formatCount(kpi.current, locale)),
    dash(kpi.previous == null ? "—" : formatCount(kpi.previous, locale)),
    dash(kpiDeltaText(kpi, locale)),
    dash(kpi.scope === "queue" ? t(locale, "di.command.kpiQueueBadge") : t(locale, "di.command.kpiPeriodBadge")),
  ]);

  const seizureRows = report.seizures.map((row) => [
    dash(row.label),
    dash(row.measurementKind),
    dash(`${formatCount(row.value, locale)} ${row.displayUnit}`),
    dash(row.previousValue == null ? "—" : `${formatCount(row.previousValue, locale)} ${row.displayUnit}`),
    dash(
      formatDelta(
        {
          absoluteChange: row.absoluteChange ?? 0,
          percentChange: row.percentChange,
          direction: (row.absoluteChange ?? 0) > 0 ? "up" : (row.absoluteChange ?? 0) < 0 ? "down" : "same",
        },
        locale
      )
    ),
  ]);

  const trendRows = report.trend.map((row) => [
    dash(row.label),
    dash(formatCount(row.caseCount, locale)),
    `<div class="bar" role="img" aria-label="${escapeHtml(`${row.label}: ${formatCount(row.caseCount, locale)}`)}"><span class="bar-fill" style="width:${Math.max(0, Math.min(100, row.barPercent))}%"></span></div>`,
  ]);

  const areaRows = report.areas.map((row) => [
    dash(String(row.rank)),
    dash(row.province),
    dash(formatCount(row.caseCount, locale)),
    dash(row.previousCaseCount == null ? "—" : formatCount(row.previousCaseCount, locale)),
  ]);

  const unitRows = report.units.rows.map((row) => [
    dash(row.unitLabel),
    dash(formatCount(row.caseCount, locale)),
    dash(formatCount(row.arrestedPersonCount, locale)),
    dash(row.methTabletCount == null ? "—" : formatCount(row.methTabletCount, locale)),
    dash(row.iceCrystalKg == null ? "—" : formatCount(row.iceCrystalKg, locale)),
  ]);

  const attentionRows = report.attentionItems.map((row) => [
    dash(row.group === "review" ? t(locale, "di.command.attentionReview") : t(locale, "di.command.attentionComplete")),
    dash(row.label),
    dash(formatCount(row.count, locale)),
    dash(row.queueScope ? t(locale, "di.command.kpiQueueBadge") : t(locale, "di.command.kpiPeriodBadge")),
  ]);

  const readinessRows = [
    [dash(t(locale, "di.command.readinessMissingArrested")), dash(formatCount(report.dataReadiness.casesMissingArrested, locale))],
    [dash(t(locale, "di.command.readinessMissingUnit")), dash(formatCount(report.dataReadiness.casesMissingReportingUnit, locale))],
    [dash(t(locale, "di.command.readinessMissingCoords")), dash(formatCount(report.dataReadiness.casesMissingCoordinates, locale))],
    [dash(t(locale, "di.command.readinessIncompleteSeizure")), dash(formatCount(report.dataReadiness.casesWithIncompleteSeizureCategory, locale))],
  ];

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(t(locale, "di.export.commanderReport"))}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; @bottom-right { content: counter(page); } }
  body { font-family: "Sarabun", "Noto Sans Thai", "Thonburi", "Leelawadee UI", "Segoe UI", Tahoma, sans-serif; color: #111; font-size: 12px; line-height: 1.45; margin: 0; }
  header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
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
  <h1>${escapeHtml(t(locale, "di.export.commanderReportTitle"))}</h1>
  <p class="meta">${escapeHtml(official)}</p>
  <p class="meta">${escapeHtml(t(locale, "di.export.generatedAt"))}: ${escapeHtml(report.generatedAt)}</p>
</header>
<section>
  <h2>1. ${escapeHtml(t(locale, "di.export.sectionScope"))}</h2>
  <table>
    <tbody>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.periodScope"))}</th><td>${dash(`${report.scope.periodFrom} – ${report.scope.periodTo}`)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.command.filterFy"))}</th><td>${dash(fyLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.organizationScope"))}</th><td>${dash(report.scope.organization.label)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.provinceScope"))}</th><td>${dash(report.scope.provinceLabel)}</td></tr>
      <tr><th scope="row">${escapeHtml(t(locale, "di.export.comparisonPeriod"))}</th><td>${dash(report.comparisonScope.label)}</td></tr>
    </tbody>
  </table>
</section>
<section>
  <h2>2. ${escapeHtml(t(locale, "di.export.sectionSummary"))}</h2>
  ${
    report.executiveSummary.length > 0
      ? `<ul>${report.executiveSummary.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
      : empty(locale)
  }
</section>
<section>
  <h2>3. ${escapeHtml(t(locale, "di.export.sectionKpis"))}</h2>
  ${kpiRows.length ? table([t(locale, "di.export.indicator"), t(locale, "di.export.currentValue"), t(locale, "di.export.previousValue"), t(locale, "di.export.kpiDelta"), t(locale, "di.export.scopeKind")], kpiRows) : empty(locale)}
</section>
<section>
  <h2>4. ${escapeHtml(t(locale, "di.command.seizuresTitle"))}</h2>
  ${seizureRows.length ? table([t(locale, "di.export.category"), t(locale, "di.export.measurementKind"), t(locale, "di.export.currentValue"), t(locale, "di.export.previousValue"), t(locale, "di.export.kpiDelta")], seizureRows) : empty(locale)}
  <p class="note">${escapeHtml(t(locale, "di.export.methodologyCountMass"))}</p>
</section>
<section>
  <h2>5. ${escapeHtml(t(locale, "di.export.sectionTrend"))}</h2>
  ${trendRows.length ? table([t(locale, "di.export.month"), t(locale, "di.command.areasColCases"), t(locale, "di.export.barEquivalent")], trendRows) : empty(locale)}
</section>
<section>
  <h2>6. ${escapeHtml(t(locale, "di.export.sectionAreas"))}</h2>
  ${areaRows.length ? table([t(locale, "di.export.rank"), t(locale, "di.command.areasColProvince"), t(locale, "di.command.areasColCases"), t(locale, "di.export.previousValue")], areaRows) : empty(locale)}
  <p class="note">${escapeHtml(t(locale, "di.command.areasFollowNote"))}</p>
</section>
<section>
  <h2>7. ${escapeHtml(t(locale, "di.export.sectionUnits"))}</h2>
  ${unitRows.length ? table([t(locale, "di.command.unitsColUnit"), t(locale, "di.command.unitsColCases"), t(locale, "di.command.unitsColPersons"), t(locale, "di.command.unitsColMeth"), t(locale, "di.command.unitsColCrystal")], unitRows) : empty(locale)}
  ${
    report.units.unassignedCaseCount > 0
      ? `<p class="note">${escapeHtml(t(locale, "di.command.unitsUnassigned").replace("{count}", formatCount(report.units.unassignedCaseCount, locale)))}</p>`
      : ""
  }
</section>
<section>
  <h2>8. ${escapeHtml(t(locale, "di.export.sectionAttention"))}</h2>
  <p class="note">${escapeHtml(t(locale, "di.export.attentionOperational"))}</p>
  ${attentionRows.length ? table([t(locale, "di.export.attentionGroup"), t(locale, "di.export.indicator"), t(locale, "di.export.records"), t(locale, "di.export.scopeKind")], attentionRows) : empty(locale)}
</section>
<section>
  <h2>9. ${escapeHtml(t(locale, "di.command.readinessTitle"))}</h2>
  <p class="note">${escapeHtml(t(locale, "di.command.readinessOfPeriod"))}: ${escapeHtml(formatCount(report.dataReadiness.totalCases, locale))}</p>
  ${table([t(locale, "di.export.indicator"), t(locale, "di.export.records")], readinessRows)}
  <p class="note">${escapeHtml(t(locale, "di.command.readinessNotScore"))}</p>
</section>
<section>
  <h2>10. ${escapeHtml(t(locale, "di.export.sectionMethodology"))}</h2>
  <ul>${report.methodologyNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
</section>
<footer>
  <p>${escapeHtml(t(locale, "di.export.generatedBy"))}: ${dash(report.generatedBy)}</p>
  <p>${escapeHtml(t(locale, "di.export.generatedAt"))}: ${escapeHtml(report.generatedAt)}</p>
  <p>${escapeHtml(t(locale, "di.export.dataCurrent"))}: ${escapeHtml(report.generatedAt)}</p>
  <p>${escapeHtml(report.systemName)} · ${escapeHtml(official)}</p>
</footer>
</body>
</html>`;
}
