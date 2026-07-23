/**
 * Executive Report CSV export (Phase 49C).
 * UTF-8 BOM + RFC 4180 — Excel-openable. Pure — no I/O.
 */
import type { ExecutiveReportViewModel } from "@/lib/commander_reports/types";

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined || value === "" ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Builds Excel-openable CSV for the current report table + cover metadata. */
export function buildExecutiveReportCsv(report: ExecutiveReportViewModel): string {
  const lines: string[] = [];
  lines.push(csvCell(report.cover.titleTh));
  lines.push(csvCell(report.cover.subtitleTh));
  lines.push(csvCell(`ขอบเขต: ${report.cover.organizationScopeTh}`));
  lines.push(csvCell(report.cover.fiscalYearTh));
  lines.push(csvCell(`วันที่จัดทำ: ${report.cover.generatedDateTh}`));
  lines.push(csvCell(`จัดทำโดย: ${report.cover.preparedByTh}`));
  lines.push(csvCell(`เวอร์ชันรายงาน: ${report.cover.reportVersion}`));
  lines.push(csvCell(report.cover.confidentialTh));
  lines.push(csvCell(`จำนวนรายการ: ${report.resultCount.toLocaleString("th-TH")}`));
  lines.push("");
  lines.push(csvCell("—— สรุปผู้บริหาร ——"));
  for (const kpi of report.kpis) {
    lines.push([csvCell(kpi.labelTh), csvCell(kpi.value)].join(","));
  }
  lines.push("");
  lines.push(csvCell("—— ข้อเสนอแนะ (ตามกฎ) ——"));
  for (const rec of report.recommendations) {
    lines.push(csvCell(rec.textTh));
  }
  lines.push("");
  lines.push(report.columns.map((c) => csvCell(c.labelTh)).join(","));
  for (const row of report.rows) {
    lines.push(report.columns.map((c) => csvCell(row.cells[c.id] ?? "")).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export function executiveReportCsvFilename(report: ExecutiveReportViewModel): string {
  const safe = report.type.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const date = report.cover.generatedDateTh.replace(/\//g, "-");
  return `commander-report-${safe}-${date}.csv`;
}
