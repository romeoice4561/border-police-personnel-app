/**
 * Personnel Intelligence Service — request/response DTOs (Phase 49.5).
 *
 * Serializable contracts only. Consumers must not import CommanderQueryOfficer
 * or Prisma models through this facade.
 */
import type { OfficerPriority } from "@/lib/intelligence";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { TrainingStatus } from "@/lib/intelligence/training/types";
import type { ReadinessLevel } from "@/lib/intelligence/document_readiness";
import type { ExecutiveReportType, ReportFilterState } from "@/lib/commander_reports/types";

export const INTELLIGENCE_MAX_PAGE_SIZE = 100;
export const INTELLIGENCE_DEFAULT_PAGE_SIZE = 20;

export type IntelligenceDocumentStatus = "missing" | "expired" | "warning" | "complete";
export type IntelligenceRetirementWithin = "within-1-year" | "within-3-years" | "within-5-years";
export type BirthdayWindowDays = 30 | 60 | 90;

export interface IntelligenceScope {
  regionId?: number;
  battalionId?: number;
  companyId?: number;
}

export interface PersonnelIntelligenceFilters {
  rank?: string;
  positionLevel?: string;
  promotionStatus?: PromotionEligibilityStatus;
  retirementWithin?: IntelligenceRetirementWithin;
  documentStatus?: IntelligenceDocumentStatus;
  trainingStatus?: TrainingStatus;
  readiness?: ReadinessLevel;
  priority?: OfficerPriority;
  birthdayWindow?: BirthdayWindowDays;
  /** Case-insensitive contains on displayName / rank / unit / position. */
  searchText?: string;
  /** Ready-for-promotion convenience (eligibleNow / EligibleThisYear / AlreadyEligible). */
  readyForPromotion?: boolean;
  /** overdueYears > 0 (completed waiting years; first eligible cycle = 0) */
  promotionOverdue?: boolean;
}

export type IntelligenceSortField =
  | "name"
  | "rank"
  | "organization"
  | "priority"
  | "promotionStatus"
  | "retirementYear"
  | "readiness"
  | "birthday";

export type SortOrder = "asc" | "desc";

export interface PersonnelIntelligenceQuery {
  scope?: IntelligenceScope;
  filters?: PersonnelIntelligenceFilters;
  sort?: IntelligenceSortField;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
  /** ISO-8601 date or datetime; defaults to now when omitted. */
  asOf?: string;
}

export interface PaginationDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FilterOptionsDto {
  ranks: string[];
  positionLevels: string[];
  regions: Array<{ id: number; label: string }>;
  battalions: Array<{ id: number; regionId: number | null; label: string }>;
  companies: Array<{ id: number; battalionId: number | null; label: string }>;
  priorities: OfficerPriority[];
}

export interface CountBucketDto {
  id: string;
  labelTh: string;
  value: number;
}

export interface CommanderSummaryDto {
  asOfIso: string;
  fiscalYearBe: number;
  displayFiscalYearTh: string;
  personnelTotal: number;
  promotionReady: number;
  promotionOverdue: number;
  retiringWithin12Months: number;
  documentsMissing: number;
  documentsExpired: number;
  trainingMissing: number;
  profileIncomplete: number;
  criticalOfficers: number;
  highPriorityOfficers: number;
  aiReady: number;
  upcomingBirthdays30: number;
  kpis: CountBucketDto[];
  filterOptions: FilterOptionsDto;
}

export interface OfficerIntelligenceSummaryDto {
  officerId: string;
  rank: string;
  displayName: string;
  currentPosition: string | null;
  currentUnit: string | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  companyLabel: string;
  priority: OfficerPriority;
  readinessLevel: string;
  promotionStatus: PromotionEligibilityStatus;
  displayPromotionStatusTh: string | null;
  retirementYearBe: number | null;
  trainingStatus: TrainingStatus;
  displayTrainingStatusTh: string | null;
  missingDocumentsCount: number;
  expiredDocumentsCount: number;
  hasOfficialPortrait: boolean;
  /** Portrait URL already resolved for authorized commander surfaces — never a storage path. */
  officialPortraitUrl: string | null;
  nextActionTh: string;
  profileHref: string;
}

export interface OfficerIntelligenceDetailDto extends OfficerIntelligenceSummaryDto {
  ageDisplayTh: string | null;
  serviceDisplayTh: string | null;
  displayAgeYearsMonthsTh: string | null;
  flagCodes: string[];
  recommendedActionsTh: string[];
  birthdayIso: string | null;
  /**
   * Phase 49.7: canonical promotion ground-truth fields — read directly
   * from CommanderQueryOfficer.promotionIntelligence (PromotionSummary),
   * never recomputed. `firstEligibleYearBe`/`firstEligibleDate` are the
   * PROJECTED first-eligible year/date (computable even before the officer
   * reaches eligibility — distinct from the historical-only eligibleDate
   * the tool never exposed before this phase).
   */
  targetPositionLevel: string | null;
  currentPositionLevelStartYearBe: number | null;
  requiredTenureYears: number | null;
  firstEligibleYearBe: number | null;
  firstEligibleDate: string | null;
  waitingReasonTh: string | null;
  /**
   * Phase 49.8: canonical rank-tenure + data-confidence fields — read
   * directly from CommanderQueryOfficer.rankStartedAtYearBe/yearsInRankCount
   * and PromotionSummary.confidence/confidenceReasonTh/missingEvidence,
   * never recomputed. `confidence`/`missingEvidence` let a tool consumer
   * distinguish "genuinely not eligible" from "cannot assess due to missing
   * evidence" — see lib/promotion/eligibility_policy.ts's MissingEvidenceKey.
   */
  currentRankStartedAtYearBe: number | null;
  yearsInRank: number | null;
  promotionConfidence: "confirmed" | "derived" | "incomplete" | "unknown";
  promotionConfidenceReasonTh: string | null;
  promotionMissingEvidence: string[];
}

export interface PromotionSummaryDto {
  asOfIso: string;
  readyCount: number;
  overdueCount: number;
  byStatus: CountBucketDto[];
}

export interface RetirementSummaryDto {
  asOfIso: string;
  within12Months: number;
  within3Years: number;
  within5Years: number;
}

export interface DocumentSummaryDto {
  asOfIso: string;
  missingRequiredOfficers: number;
  expiredOfficers: number;
  readyOfficers: number;
}

export interface TrainingSummaryDto {
  asOfIso: string;
  missingRequired: number;
  expired: number;
  expiringSoon: number;
}

export interface ExecutiveBriefDto {
  asOfIso: string;
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

export interface ReportProjectionDto {
  type: ExecutiveReportType;
  titleTh: string;
  resultCount: number;
  filterSummaryTh: string;
  kpiLabelsTh: string[];
  recommendationTextsTh: string[];
  generatedDateTh: string;
  reportVersion: string;
}

export interface OfficerSearchResultDto {
  filters: PersonnelIntelligenceFilters & IntelligenceScope;
  pagination: PaginationDto;
  officers: OfficerIntelligenceSummaryDto[];
  aggregate: {
    total: number;
    criticalOfficers: number;
    readyForPromotion: number;
    documentsExpired: number;
  };
}

export interface GetReportProjectionInput {
  type: ExecutiveReportType | string;
  scope?: IntelligenceScope;
  /** Optional Phase 49C report filters; merged with scope. */
  reportFilters?: ReportFilterState;
  preparedByTh?: string;
  asOf?: string;
}
