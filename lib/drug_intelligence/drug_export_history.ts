/**
 * Safe recent-export history projection (DI-10E.4).
 * Never returns raw DrugAuditLog.detail, searchQuery, HTML, or identifiers.
 */

import type { DrugExportFormat, DrugExportType } from "@/lib/drug_intelligence/drug_export_types";

export const DRUG_EXPORT_HISTORY_DEFAULT_TAKE = 25;
export const DRUG_EXPORT_HISTORY_MAX_TAKE = 50;

export const DRUG_EXPORT_HISTORY_REPORT_KINDS = [
  "commander",
  "case",
  "person",
  "board",
  "workspace",
  "cases_csv",
  "persons_csv",
  "map",
  "other",
] as const;
export type DrugExportHistoryReportKind = (typeof DRUG_EXPORT_HISTORY_REPORT_KINDS)[number];

export const DRUG_EXPORT_HISTORY_FORMAT_KINDS = ["print", "csv", "other"] as const;
export type DrugExportHistoryFormatKind = (typeof DRUG_EXPORT_HISTORY_FORMAT_KINDS)[number];

export interface DrugExportHistoryItem {
  id: string;
  createdAt: string;
  reportKind: DrugExportHistoryReportKind;
  formatKind: DrugExportHistoryFormatKind;
  recordCount: number | null;
  filename: string | null;
}

const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;
const UNSAFE_FILENAME = /phone|national|passport|alien|imsi|iccid|imei|vin|plate|lat|lng|signed|annotat|html|search/i;

const EXPORT_TYPE_KIND: Partial<Record<DrugExportType, DrugExportHistoryReportKind>> = {
  COMMANDER_REPORT: "commander",
  CASE_REPORT: "case",
  PERSON_DATA: "person",
  BOARD_DATA: "board",
  NETWORK_DATA: "workspace",
  OPERATIONAL_CASES: "cases_csv",
  OPERATIONAL_PERSONS: "persons_csv",
  MAP_DATA: "map",
};

const FORMAT_KIND: Partial<Record<DrugExportFormat, DrugExportHistoryFormatKind>> = {
  HTML_PRINT: "print",
  CSV: "csv",
};

export function clampExportHistoryTake(take: number | undefined): number {
  if (take == null || !Number.isFinite(take)) return DRUG_EXPORT_HISTORY_DEFAULT_TAKE;
  const n = Math.trunc(take);
  if (n < 1) return DRUG_EXPORT_HISTORY_DEFAULT_TAKE;
  return Math.min(DRUG_EXPORT_HISTORY_MAX_TAKE, n);
}

function isExportType(value: string): value is DrugExportType {
  return value in EXPORT_TYPE_KIND || value === "MAP_DATA" || value === "OPERATIONAL_ALERTS";
}

function isExportFormat(value: string): value is DrugExportFormat {
  return value === "HTML_PRINT" || value === "CSV" || value === "JSON";
}

function safeFilename(value: string | undefined): string | null {
  if (!value || !SAFE_FILENAME.test(value) || UNSAFE_FILENAME.test(value)) return null;
  return value;
}

function parseAllowlistedDetail(detail: string | null): {
  exportType?: string;
  format?: string;
  recordCount: number | null;
  filename: string | null;
} {
  if (!detail) return { recordCount: null, filename: null };
  try {
    const parsed: unknown = JSON.parse(detail);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { recordCount: null, filename: null };
    }
    const obj = parsed as Record<string, unknown>;
    const exportType = typeof obj.exportType === "string" ? obj.exportType : undefined;
    const format = typeof obj.format === "string" ? obj.format : undefined;
    const recordCount = typeof obj.recordCount === "number" && Number.isFinite(obj.recordCount) ? obj.recordCount : null;
    const filename = typeof obj.filename === "string" ? safeFilename(obj.filename) : null;
    return { exportType, format, recordCount, filename };
  } catch {
    return { recordCount: null, filename: null };
  }
}

export function projectExportHistoryItem(row: {
  id: unknown;
  createdAt: Date | string;
  detail: string | null;
}): DrugExportHistoryItem {
  const parsed = parseAllowlistedDetail(row.detail);
  const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString();
  const reportKind =
    parsed.exportType && isExportType(parsed.exportType) ? (EXPORT_TYPE_KIND[parsed.exportType] ?? "other") : "other";
  const formatKind =
    parsed.format && isExportFormat(parsed.format) ? (FORMAT_KIND[parsed.format] ?? "other") : "other";
  return {
    id: String(row.id),
    createdAt,
    reportKind,
    formatKind,
    recordCount: parsed.recordCount,
    filename: parsed.filename,
  };
}

export function projectExportHistoryItems(
  rows: Array<{ id: unknown; createdAt: Date | string; detail: string | null }>
): DrugExportHistoryItem[] {
  return rows.map(projectExportHistoryItem);
}
