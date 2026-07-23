/**
 * Print metadata helpers for PDF-ready HTML layout (Phase 49C).
 * Pure — no DOM, no I/O. Components apply these into print chrome.
 */
import type { ExecutiveReportViewModel } from "@/lib/commander_reports/types";

export interface ReportPrintMeta {
  titleTh: string;
  subtitleTh: string;
  organizationScopeTh: string;
  fiscalYearTh: string;
  generatedDateTh: string;
  preparedByTh: string;
  reportVersion: string;
  confidentialTh: string;
  signatureCommanderTh: string;
  signaturePreparerTh: string;
  landscapeHintTh: string;
}

/** Extracts print/PDF-ready cover + signature labels from a composed report. */
export function buildReportPrintMeta(report: ExecutiveReportViewModel): ReportPrintMeta {
  return {
    titleTh: report.cover.titleTh,
    subtitleTh: report.cover.subtitleTh,
    organizationScopeTh: report.cover.organizationScopeTh,
    fiscalYearTh: report.cover.fiscalYearTh,
    generatedDateTh: report.cover.generatedDateTh,
    preparedByTh: report.cover.preparedByTh,
    reportVersion: report.cover.reportVersion,
    confidentialTh: report.cover.confidentialTh,
    signatureCommanderTh: "ผู้บังคับบัญชา ....................................................",
    signaturePreparerTh: `ผู้จัดทำ ${report.cover.preparedByTh} ....................................................`,
    landscapeHintTh: "แนะนำพิมพ์แนวนอน (Landscape) · Save as PDF จากกล่องโต้ตอบพิมพ์ของเบราว์เซอร์",
  };
}
