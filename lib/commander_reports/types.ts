/**
 * Executive Report Center — view-model types (Phase 49C).
 *
 * Pure declarations only. Every numeric field is tallied from already-computed
 * CommanderQueryOfficer engine outputs — this module never invents scores or
 * re-runs Promotion / Retirement / Document / Training intelligence.
 */
import type { OfficerPriority } from "@/lib/intelligence";
import type { TrainingStatus } from "@/lib/intelligence/training/types";
import type { ReadinessLevel } from "@/lib/intelligence/document_readiness";
import type { CommanderQueryOfficer, CommanderQueryOptions } from "@/lib/commander_query/types";

export const EXECUTIVE_REPORT_TYPES = [
  "personnelSummary",
  "promotionReadiness",
  "retirementForecast",
  "documentCompleteness",
  "documentExpiry",
  "trainingReadiness",
  "highPriority",
  "criticalAction",
  "birthday",
  "monthlyBrief",
] as const;

export type ExecutiveReportType = (typeof EXECUTIVE_REPORT_TYPES)[number];

export type ReportDocumentStatusFilter = "missing" | "expired" | "warning" | "complete";
export type ReportRetirementWithin = "within-1-year" | "within-3-years" | "within-5-years";

export interface ReportFilterState {
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  rank?: string;
  positionLevel?: string;
  /** Gregorian-labeled fiscal year (matches personnel_calendar / RetirementYear). */
  fiscalYear?: number;
  priority?: OfficerPriority;
  readiness?: ReadinessLevel;
  documentStatus?: ReportDocumentStatusFilter;
  trainingStatus?: TrainingStatus;
  retirementWithin?: ReportRetirementWithin;
}

export interface ReportKpiSnapshot {
  id: string;
  labelTh: string;
  value: number;
}

export interface ReportTableColumn {
  id: string;
  labelTh: string;
}

export interface ReportTableRow {
  officerId: string;
  cells: Record<string, string>;
  href: string;
}

export interface ReportRecommendation {
  /** Rule-based Thai recommendation — never LLM-generated. */
  textTh: string;
  severity: "info" | "warning" | "critical";
}

export interface ReportCoverMeta {
  titleTh: string;
  subtitleTh: string;
  organizationScopeTh: string;
  fiscalYearTh: string;
  generatedDateTh: string;
  preparedByTh: string;
  reportVersion: string;
  confidentialTh: string;
}

export interface ExecutiveReportViewModel {
  type: ExecutiveReportType;
  cover: ReportCoverMeta;
  kpis: ReportKpiSnapshot[];
  recommendations: ReportRecommendation[];
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
  /** Officers after report-type projection (subset of filtered set). */
  officers: CommanderQueryOfficer[];
  /** One-page brief fields (always populated; primary surface for monthlyBrief). */
  brief: CommanderBriefViewModel;
  resultCount: number;
  filterSummaryTh: string;
}

export interface CommanderBriefViewModel {
  totalPersonnel: number;
  readyForPromotion: number;
  retiringWithin12Months: number;
  expiredDocuments: number;
  missingTraining: number;
  criticalOfficers: number;
  aiReady: number;
  summaryLinesTh: string[];
  actionItemsTh: string[];
}

export interface BuildExecutiveReportInput {
  /** Registered report id; unknown values fall back to personnelSummary. */
  type: ExecutiveReportType | string;
  officers: readonly CommanderQueryOfficer[];
  options: CommanderQueryOptions;
  filters: ReportFilterState;
  asOf: Date;
  preparedByTh: string;
}

export const REPORT_VERSION = "49C.1";
export const CONFIDENTIAL_FOOTER_TH = "ชั้นความลับ: ใช้ภายในหน่วยงานเท่านั้น";
