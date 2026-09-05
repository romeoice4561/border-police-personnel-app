/**
 * DI-10B export dispatch. OPERATIONAL_CASES CSV is the only live generator.
 * Other types return a preview contract or NOT_IMPLEMENTED_FOR_TYPE.
 *
 * Queries DrugCaseRepository with pageSize = hardLimit + 1 — never an unbounded fetch.
 * Writes DrugAuditLog only.
 */

import { randomUUID } from "node:crypto";
import type { DatabaseClient, DrugCase } from "@/lib/database/database_types";
import { DrugCaseRepository } from "@/lib/database/repositories/drug_case_repository";
import { buildCsvDocument, formatCsvIsoDate } from "@/lib/export/csv";
import { buildDrugExportFilename } from "@/lib/export/filename";
import { recordExportCreated } from "@/lib/drug_intelligence/drug_export_audit";
import { summarizeExportContext, type ResolvedDrugExportContextV1 } from "@/lib/drug_intelligence/drug_export_context";
import { exportLimitsForType } from "@/lib/drug_intelligence/drug_export_limits";
import { assertExportColumnsAllowed, columnsForPreset } from "@/lib/drug_intelligence/drug_export_presets";
import {
  OPERATIONAL_CASES_COLUMNS,
  type DrugExportFormat,
  type DrugExportMaskingMode,
  type DrugExportPreset,
  type DrugExportPreviewV1,
  type DrugExportType,
} from "@/lib/drug_intelligence/drug_export_types";
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

function parseIsoStart(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseIsoEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`);
}

function caseListParams(context: ResolvedDrugExportContextV1, pageSize: number) {
  return {
    page: 1,
    pageSize,
    status: context.geo?.status,
    province: context.geo?.province,
    district: context.geo?.district,
    headquartersId: context.organization?.hqId,
    regionId: context.organization?.regionId,
    battalionId: context.organization?.battalionId,
    companyId: context.organization?.companyId,
    arrestDateFrom: context.period?.dateFrom ? parseIsoStart(context.period.dateFrom) : undefined,
    arrestDateTo: context.period?.dateTo ? parseIsoEnd(context.period.dateTo) : undefined,
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

export class DrugExportService {
  constructor(private readonly db: DatabaseClient) {}

  isImplemented(exportType: DrugExportType, format: DrugExportFormat): boolean {
    return exportType === "OPERATIONAL_CASES" && format === "CSV";
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
    const columnMeta = OPERATIONAL_CASES_COLUMNS.filter((c) => selected.includes(c.key)).map((c) => ({
      key: c.key,
      label: locale === "en" ? c.labelEn : c.labelTh,
    }));
    return {
      exportType: input.exportType,
      format: input.format,
      locale,
      contextSummary: summarizeExportContext(input.context),
      estimatedRecordCount: input.estimatedRecordCount,
      softLimit,
      hardLimit,
      columns: columnMeta,
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
      const repo = new DrugCaseRepository(this.db);
      const { total } = await repo.list(caseListParams(input.context, 1));
      estimatedRecordCount = total;
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
    if (input.exportType === "OPERATIONAL_CASES" && input.format !== "CSV") throw new DrugExportInvalidFormatError();
    if (!this.isImplemented(input.exportType, input.format)) throw new DrugExportNotImplementedError();

    const { hardLimit } = exportLimitsForType(input.exportType);
    const repo = new DrugCaseRepository(this.db);
    const listed = await repo.list(caseListParams(input.context, hardLimit + 1));
    if (listed.total > hardLimit) throw new DrugExportTooManyRowsError();

    const selected = columnsForPreset(input.exportType, input.preset ?? "OPERATIONAL", input.columns);
    const locale: Language = input.context.locale;
    const columns = OPERATIONAL_CASES_COLUMNS.filter((c) => selected.includes(c.key)).map((c) => ({
      key: c.key,
      label: locale === "en" ? c.labelEn : c.labelTh,
    }));
    const rows = listed.rows.map(operationalCaseRow);
    const body = buildCsvDocument(columns, rows);
    const filename = buildDrugExportFilename({
      kind: "drug-cases",
      fiscalYearBe: input.context.period?.fiscalYearBe,
      ext: "csv",
      now: new Date(input.context.generatedAt),
    });
    const exportId = randomUUID();
    await recordExportCreated(this.db, {
      actorId: input.context.actorId,
      actorName: input.actorName,
      exportId,
      exportType: input.exportType,
      format: input.format,
      locale,
      recordCount: rows.length,
      contextSummary: summarizeExportContext(input.context),
      filename,
    });
    return { filename, body, recordCount: rows.length, exportId };
  }
}
