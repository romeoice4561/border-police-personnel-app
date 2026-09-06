/**
 * DI-10C/D export dispatch.
 * Live generators: OPERATIONAL_CASES CSV, OPERATIONAL_PERSONS CSV,
 * CASE_REPORT HTML_PRINT, COMMANDER_REPORT HTML_PRINT.
 * OPERATIONAL_ALERTS is deferred — Alert Center still uses unbounded findAll.
 */

import { randomUUID } from "node:crypto";
import type { DatabaseClient, DrugCase } from "@/lib/database/database_types";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { filterCasesByCompleteness } from "@/lib/drug_intelligence/drug_case_completeness";
import {
  buildDrugCaseReportV1,
  DrugExportCaseNotFoundError,
  DrugExportInvalidCaseError,
  renderDrugCaseReportHtml,
} from "@/lib/drug_intelligence/drug_case_report";
import {
  buildDrugCommanderReportV1,
  renderDrugCommanderReportHtml,
} from "@/lib/drug_intelligence/drug_commander_report";
import { exportContextToCommanderFilter } from "@/lib/drug_intelligence/drug_export_commander_context";
import { DrugCommanderDashboardService } from "@/lib/drug_intelligence/drug_commander_dashboard_service";
import { resolveCommanderDashboardScope } from "@/lib/drug_intelligence/drug_commander_filter";
import { recordExportCreated } from "@/lib/drug_intelligence/drug_export_audit";
import { summarizeExportContext, type ResolvedDrugExportContextV1 } from "@/lib/drug_intelligence/drug_export_context";
import { exportLimitsForType } from "@/lib/drug_intelligence/drug_export_limits";
import { parseExportIsoEnd, parseExportIsoStart, resolveExportPeriod } from "@/lib/drug_intelligence/drug_export_period";
import { assertExportColumnsAllowed, columnsForPreset } from "@/lib/drug_intelligence/drug_export_presets";
import {
  COMMANDER_REPORT_SECTIONS,
  OPERATIONAL_CASES_COLUMNS,
  OPERATIONAL_PERSONS_COLUMNS,
  type DrugExportFormat,
  type DrugExportMaskingMode,
  type DrugExportPreset,
  type DrugExportPreviewV1,
  type DrugExportType,
} from "@/lib/drug_intelligence/drug_export_types";
import { buildCsvDocument, formatCsvIsoDate } from "@/lib/export/csv";
import { buildDrugExportFilename } from "@/lib/export/filename";
import { translate, type Language } from "@/lib/i18n/dictionary";

export class DrugExportTooManyRowsError extends Error {
  readonly code = "TOO_MANY_ROWS";
  constructor() {
    super("too many rows");
  }
}

export class DrugExportNotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED_FOR_TYPE";
  constructor() {
    super("not implemented");
  }
}

export class DrugExportInvalidColumnsError extends Error {
  readonly code = "INVALID_COLUMNS";
  constructor() {
    super("invalid columns");
  }
}

export class DrugExportInvalidFormatError extends Error {
  readonly code = "INVALID_FORMAT";
  constructor() {
    super("invalid format");
  }
}

export { DrugExportCaseNotFoundError, DrugExportInvalidCaseError };

function caseListParams(context: ResolvedDrugExportContextV1, pageSize: number) {
  const period = resolveExportPeriod(context.period);
  return {
    page: 1,
    pageSize,
    query: context.searchQuery,
    status: context.geo?.status,
    province: context.geo?.province,
    district: context.geo?.district,
    headquartersId: context.organization?.hqId,
    regionId: context.organization?.regionId,
    battalionId: context.organization?.battalionId,
    companyId: context.organization?.companyId,
    arrestDateFrom: period.dateFrom ? parseExportIsoStart(period.dateFrom) : undefined,
    arrestDateTo: period.dateTo ? parseExportIsoEnd(period.dateTo) : undefined,
  };
}

function operationalCaseRow(row: DrugCase): Record<string, string> {
  return {
    caseId: row.id,
    caseNumber: row.caseNumber,
    title: row.title,
    status: row.status,
    arrestDate: formatCsvIsoDate(row.arrestDate),
    province: row.province ?? "",
    reportingUnit: row.reportingUnitText ?? "",
    leadUnit: row.leadUnitText ?? "",
    createdAt: formatCsvIsoDate(row.createdAt),
  };
}

const COMMANDER_SECTION_KEYS: Record<(typeof COMMANDER_REPORT_SECTIONS)[number], Parameters<typeof translate>[0]> = {
  scope: "di.export.sectionScope",
  summary: "di.export.sectionSummary",
  kpis: "di.export.sectionKpis",
  seizures: "di.export.sectionSeizures",
  trend: "di.export.sectionTrend",
  areas: "di.export.sectionAreas",
  units: "di.export.sectionUnits",
  attention: "di.export.sectionAttention",
  readiness: "di.command.readinessTitle",
  methodology: "di.export.sectionMethodology",
};

function columnMeta(
  exportType: DrugExportType,
  keys: readonly string[],
  locale: Language
): Array<{ key: string; label: string }> {
  if (exportType === "COMMANDER_REPORT") {
    return COMMANDER_REPORT_SECTIONS.map((key) => ({
      key,
      label: translate(COMMANDER_SECTION_KEYS[key], locale),
    }));
  }
  const source = exportType === "OPERATIONAL_PERSONS" ? OPERATIONAL_PERSONS_COLUMNS : OPERATIONAL_CASES_COLUMNS;
  return source.filter((c) => keys.includes(c.key)).map((c) => ({ key: c.key, label: locale === "en" ? c.labelEn : c.labelTh }));
}

export class DrugExportService {
  constructor(private readonly db: DatabaseClient) {}

  isImplemented(exportType: DrugExportType, format: DrugExportFormat): boolean {
    if (exportType === "OPERATIONAL_CASES" && format === "CSV") return true;
    if (exportType === "OPERATIONAL_PERSONS" && format === "CSV") return true;
    if (exportType === "CASE_REPORT" && format === "HTML_PRINT") return true;
    if (exportType === "COMMANDER_REPORT" && format === "HTML_PRINT") return true;
    return false;
  }

  buildPreview(input: {
    exportType: DrugExportType;
    format: DrugExportFormat;
    context: ResolvedDrugExportContextV1;
    preset?: DrugExportPreset;
    columns?: readonly string[];
    maskingMode: DrugExportMaskingMode;
    estimatedRecordCount: number | null;
  }): DrugExportPreviewV1 {
    const { softLimit, hardLimit } = exportLimitsForType(input.exportType);
    const forbidden = assertExportColumnsAllowed(input.columns ?? []);
    const selected = columnsForPreset(input.exportType, input.preset ?? "OPERATIONAL", input.columns);
    const locale = input.context.locale;
    const warnings: string[] = [];
    if (forbidden.length > 0) warnings.push(translate("di.export.invalidColumns", locale));
    if (!this.isImplemented(input.exportType, input.format)) warnings.push(translate("di.export.notImplemented", locale));
    if (input.estimatedRecordCount != null && input.estimatedRecordCount > softLimit) {
      warnings.push(translate("di.export.softLimitWarning", locale));
    }
    return {
      exportType: input.exportType,
      format: input.format,
      locale,
      contextSummary: summarizeExportContext(input.context),
      estimatedRecordCount: input.estimatedRecordCount,
      softLimit,
      hardLimit,
      columns: columnMeta(input.exportType, selected, locale),
      presets: ["MINIMAL", "OPERATIONAL", "INTELLIGENCE", "CUSTOM"],
      maskingMode: input.maskingMode,
      warnings,
      implemented: this.isImplemented(input.exportType, input.format) && forbidden.length === 0,
    };
  }

  async preview(input: {
    exportType: DrugExportType;
    format: DrugExportFormat;
    context: ResolvedDrugExportContextV1;
    preset?: DrugExportPreset;
    columns?: readonly string[];
    maskingMode: DrugExportMaskingMode;
  }): Promise<DrugExportPreviewV1> {
    const forbidden = assertExportColumnsAllowed(input.columns ?? []);
    if (forbidden.length > 0) throw new DrugExportInvalidColumnsError();
    let estimatedRecordCount: number | null = null;
    if (input.exportType === "OPERATIONAL_CASES") {
      const listed = await this.listOperationalCases(input.context);
      estimatedRecordCount = listed.total;
    } else if (input.exportType === "OPERATIONAL_PERSONS") {
      estimatedRecordCount = await this.countOperationalPersons(input.context);
    } else if (input.exportType === "CASE_REPORT") {
      if (!input.context.case?.caseId) throw new DrugExportInvalidCaseError();
      const repo = new DrugCaseRepository(this.db);
      const found = await repo.findById(input.context.case.caseId);
      if (!found) throw new DrugExportCaseNotFoundError();
      estimatedRecordCount = 1;
    } else if (input.exportType === "COMMANDER_REPORT") {
      const filter = resolveCommanderDashboardScope({ id: input.context.actorId }, exportContextToCommanderFilter(input.context));
      const overview = await new DrugCommanderDashboardService(this.db).getOverview(filter);
      estimatedRecordCount = overview.caseCount;
    }
    return this.buildPreview({ ...input, estimatedRecordCount });
  }

  async generate(input: {
    actorName: string;
    exportType: DrugExportType;
    format: DrugExportFormat;
    context: ResolvedDrugExportContextV1;
    preset?: DrugExportPreset;
    columns?: readonly string[];
    maskingMode: DrugExportMaskingMode;
  }): Promise<{ filename: string; body: string; recordCount: number; exportId: string }> {
    if (assertExportColumnsAllowed(input.columns ?? []).length > 0) throw new DrugExportInvalidColumnsError();
    if (!this.isImplemented(input.exportType, input.format)) {
      if (input.exportType === "OPERATIONAL_CASES" && input.format !== "CSV") throw new DrugExportInvalidFormatError();
      if (input.exportType === "OPERATIONAL_PERSONS" && input.format !== "CSV") throw new DrugExportInvalidFormatError();
      if (input.exportType === "CASE_REPORT" && input.format !== "HTML_PRINT") throw new DrugExportInvalidFormatError();
      if (input.exportType === "COMMANDER_REPORT" && input.format !== "HTML_PRINT") throw new DrugExportInvalidFormatError();
      throw new DrugExportNotImplementedError();
    }

    const locale: Language = input.context.locale;
    const now = new Date(input.context.generatedAt);
    const period = resolveExportPeriod(input.context.period);
    let body: string;
    let filename: string;
    let recordCount: number;

    if (input.exportType === "OPERATIONAL_CASES") {
      const listed = await this.listOperationalCases(input.context);
      if (listed.total > exportLimitsForType(input.exportType).hardLimit) throw new DrugExportTooManyRowsError();
      const selected = columnsForPreset(input.exportType, input.preset ?? "OPERATIONAL", input.columns);
      const columns = columnMeta(input.exportType, selected, locale);
      body = buildCsvDocument(columns, listed.rows.map(operationalCaseRow));
      filename = buildDrugExportFilename({
        kind: "drug-cases",
        fiscalYearBe: period.appliedFiscalYearBe,
        ext: "csv",
        now,
      });
      recordCount = listed.rows.length;
    } else if (input.exportType === "OPERATIONAL_PERSONS") {
      const listed = await this.listOperationalPersons(input.context);
      if (listed.total > exportLimitsForType(input.exportType).hardLimit) throw new DrugExportTooManyRowsError();
      const selected = columnsForPreset(input.exportType, input.preset ?? "OPERATIONAL", input.columns);
      const columns = columnMeta(input.exportType, selected, locale);
      body = buildCsvDocument(columns, listed.rows);
      filename = buildDrugExportFilename({ kind: "drug-persons", ext: "csv", now });
      recordCount = listed.rows.length;
    } else if (input.exportType === "CASE_REPORT") {
      const caseId = input.context.case?.caseId;
      if (!caseId) throw new DrugExportInvalidCaseError();
      const report = await buildDrugCaseReportV1(this.db, {
        caseId,
        locale,
        generatedAt: input.context.generatedAt,
        generatedBy: input.actorName,
        maskingMode: input.maskingMode,
      });
      body = renderDrugCaseReportHtml(report);
      filename = buildDrugExportFilename({
        kind: "case",
        caseNumber: report.case.caseNumber,
        ext: "html",
        now,
      });
      recordCount = 1;
    } else {
      const report = await buildDrugCommanderReportV1(this.db, {
        context: input.context,
        generatedBy: input.actorName,
      });
      body = renderDrugCommanderReportHtml(report);
      filename = buildDrugExportFilename({
        kind: "commander-report",
        fiscalYearBe: report.scope.fiscalYearBe ?? undefined,
        ext: "html",
        now,
      });
      recordCount = report.kpis.find((kpi) => kpi.id === "cases")?.current ?? 0;
    }

    const exportId = randomUUID();
    await recordExportCreated(this.db, {
      actorId: input.context.actorId,
      actorName: input.actorName,
      exportId,
      exportType: input.exportType,
      format: input.format,
      locale,
      recordCount,
      contextSummary: summarizeExportContext(input.context),
      filename,
    });
    return { filename, body, recordCount, exportId };
  }

  private async listOperationalCases(
    context: ResolvedDrugExportContextV1
  ): Promise<{ rows: DrugCase[]; total: number }> {
    const { hardLimit } = exportLimitsForType("OPERATIONAL_CASES");
    const repo = new DrugCaseRepository(this.db);
    const listed = await repo.list(caseListParams(context, hardLimit + 1));
    if (!context.completeness) return listed;
    if (listed.total > hardLimit) return listed;
    const filtered = await filterCasesByCompleteness(this.db, listed.rows, context.completeness, context.unitGroup ?? "battalion");
    return { rows: filtered, total: filtered.length };
  }

  private async countOperationalPersons(context: ResolvedDrugExportContextV1): Promise<number> {
    const repo = new DrugPersonRepository(this.db);
    const text = context.searchQuery?.trim();
    if (text) return (await repo.findActiveIdsMatchingQuery(text)).length;
    return repo.countActive();
  }

  private async listOperationalPersons(
    context: ResolvedDrugExportContextV1
  ): Promise<{ rows: Array<Record<string, string | number>>; total: number }> {
    const { hardLimit } = exportLimitsForType("OPERATIONAL_PERSONS");
    const repo = new DrugPersonRepository(this.db);
    const text = context.searchQuery?.trim();
    let persons;
    let total: number;
    if (text) {
      const ids = await repo.findActiveIdsMatchingQuery(text);
      total = ids.length;
      persons = total > hardLimit ? [] : await repo.findByIds(ids.slice(0, hardLimit));
    } else {
      total = await repo.countActive();
      persons = total > hardLimit ? [] : await repo.findActivePage(0, hardLimit);
    }
    if (total > hardLimit) return { rows: [], total };
    const caseLinks = await repo.casePersonsForPersons(persons.map((p) => p.id));
    const caseCount = new Map<string, number>();
    for (const link of caseLinks as Array<{ personId: string }>) {
      caseCount.set(link.personId, (caseCount.get(link.personId) ?? 0) + 1);
    }
    return {
      total,
      rows: persons.map((person) => ({
        personId: person.id,
        displayName: person.primaryFullName,
        status: person.status,
        caseCount: caseCount.get(person.id) ?? 0,
        createdAt: formatCsvIsoDate(person.createdAt),
      })),
    };
  }
}
