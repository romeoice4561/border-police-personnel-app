/**
 * Commander Workforce Intelligence ViewModel — pure types (Phase 52.1).
 * Presentation-neutral. No React, HTTP, Prisma, or Telegram.
 */

/** Metric availability — zero means evaluated empty; unavailable means cannot evaluate. */
export type MetricAvailability =
  | { status: "available" }
  | {
      status: "unavailable";
      reason: "SOURCE_NOT_IMPLEMENTED" | "INSUFFICIENT_DATA" | "OUT_OF_SCOPE" | "NOT_APPLICABLE";
    };

export type WorkforceSeverity = "info" | "attention" | "urgent" | "critical";

export type WorkforceDrilldownTarget =
  | "personnel-list"
  | "commander-search"
  | "commander-promotion";

export interface WorkforceDrilldownDescriptor {
  id: string;
  target: WorkforceDrilldownTarget;
  label: string;
  filters: Record<string, string | string[] | number | boolean>;
  relativeHref?: string;
}

export interface WorkforceMetric {
  key: string;
  labelTh: string;
  count: number;
  percentage: number | null;
  availability: MetricAvailability;
  drilldown: WorkforceDrilldownDescriptor | null;
  descriptionTh?: string;
}

export interface WorkforceScopeSummary {
  labelTh: string;
  regionPublicCode: string | null;
  divisionPublicCode: string | null;
  companyPublicCode: string | null;
  officerCount: number;
  /** True when public org codes were resolvable for filtering/display. */
  publicCodesAvailable: boolean;
}

export interface WorkforceFilterState {
  regionPublicCode: string | null;
  divisionPublicCode: string | null;
  companyPublicCode: string | null;
  rank: string | null;
  positionLevel: string | null;
  promotionStatus: string | null;
  retirementWindow: string | null;
  trainingStatus: string | null;
  documentStatus: string | null;
  dataQualityStatus: string | null;
  search: string | null;
}

export interface WorkforceFilterOption {
  value: string;
  labelTh: string;
  count: number;
}

export interface WorkforceAvailableFilters {
  regions: WorkforceFilterOption[];
  divisions: WorkforceFilterOption[];
  companies: WorkforceFilterOption[];
  ranks: WorkforceFilterOption[];
  positionLevels: WorkforceFilterOption[];
  promotionStatuses: WorkforceFilterOption[];
  retirementWindows: WorkforceFilterOption[];
  trainingStatuses: WorkforceFilterOption[];
  documentStatuses: WorkforceFilterOption[];
  dataQualityStatuses: WorkforceFilterOption[];
}

export interface WorkforceOverviewSection {
  metrics: WorkforceMetric[];
  byRegion: WorkforceMetric[];
  byDivision: WorkforceMetric[];
  byCompany: WorkforceMetric[];
  byRank: WorkforceMetric[];
  byPositionLevel: WorkforceMetric[];
  vacancy: WorkforceMetric;
  personnelCategory: WorkforceMetric;
}

export interface WorkforcePromotionStatusBucket {
  status: string;
  labelTh: string;
  descriptionTh: string;
  count: number;
  drilldown: WorkforceDrilldownDescriptor;
}

export interface WorkforcePromotionSection {
  totalEvaluated: number;
  eligibleTotal: number;
  blockedTotal: number;
  unknownTotal: number;
  byStatus: WorkforcePromotionStatusBucket[];
}

export type WorkforceRetirementWindowKey =
  | "this_fiscal_year"
  | "within_1_year"
  | "within_3_years"
  | "within_5_years"
  | "beyond_5_years"
  | "already_retired"
  | "unknown";

export interface WorkforceRetirementBucket {
  key: WorkforceRetirementWindowKey;
  labelTh: string;
  count: number;
  drilldown: WorkforceDrilldownDescriptor;
}

export interface WorkforceRetirementSection {
  buckets: WorkforceRetirementBucket[];
  commandPositionExposure: WorkforceMetric;
}

export interface WorkforceTrainingSection {
  totalEvaluated: number;
  complete: number;
  incomplete: number;
  missingRequired: number;
  expired: number;
  expiringSoon: number;
  unknown: number;
  noPolicy: number;
  noData: number;
  byStatus: WorkforceMetric[];
  /** Schema-limited expiry metrics when Training has no expiry column. */
  expiringSoonAvailability: MetricAvailability;
}

export interface WorkforceDocumentSection {
  totalEvaluated: number;
  complete: number;
  incomplete: number;
  expiring: number;
  expired: number;
  missingRequired: number;
  unknown: number;
  byStatus: WorkforceMetric[];
  epfCompleteness: WorkforceMetric;
}

export interface WorkforceDataQualityCategory {
  key: string;
  labelTh: string;
  count: number;
  percentage: number | null;
  severity: WorkforceSeverity;
  remediationTh: string;
  drilldown: WorkforceDrilldownDescriptor;
}

export interface WorkforceDataQualitySection {
  affectedOfficerCount: number;
  percentage: number | null;
  categories: WorkforceDataQualityCategory[];
}

export type WorkforceReadinessDimensionKey =
  | "promotion"
  | "retirement"
  | "training"
  | "documents"
  | "dataQuality";

export interface WorkforceReadinessDimension {
  key: WorkforceReadinessDimensionKey;
  labelTh: string;
  status: "available" | "unavailable";
  numerator: number | null;
  denominator: number | null;
  percentage: number | null;
  explanationTh: string;
  sourceSection: string;
  availability: MetricAvailability;
  weight: number | null;
}

export interface WorkforceReadinessSection {
  overallPercentage: number | null;
  overallAvailability: MetricAvailability;
  confidencePercentage: number | null;
  formulaTh: string;
  dimensions: WorkforceReadinessDimension[];
  breakdownTh: string[];
}

export type WorkforceActionCategory =
  | "promotion"
  | "retirement"
  | "training"
  | "documents"
  | "data_quality";

export interface WorkforceActionItem {
  key: string;
  titleTh: string;
  summaryTh: string;
  category: WorkforceActionCategory;
  severity: WorkforceSeverity;
  count: number;
  affectedScopeTh: string;
  sourceStatus: string;
  explanationTh: string;
  drilldown: WorkforceDrilldownDescriptor;
}

export interface WorkforceActionCenterSection {
  items: WorkforceActionItem[];
  /** Zero-count actions are omitted; empty list means no operational issues. */
  omittedZeroCountKeys: string[];
}

export interface WorkforceViewModelMetadata {
  schemaVersion: 1;
  composer: "commander_workforce";
  officerSourceCount: number;
  filteredOfficerCount: number;
  compositionDurationMs: number | null;
  notesTh: string[];
}

export interface CommanderWorkforceViewModel {
  generatedAt: string;
  asOfDate: string;
  scope: WorkforceScopeSummary;
  filters: WorkforceFilterState;
  availableFilters: WorkforceAvailableFilters;
  overview: WorkforceOverviewSection;
  promotion: WorkforcePromotionSection;
  retirement: WorkforceRetirementSection;
  training: WorkforceTrainingSection;
  documents: WorkforceDocumentSection;
  dataQuality: WorkforceDataQualitySection;
  readiness: WorkforceReadinessSection;
  actionCenter: WorkforceActionCenterSection;
  drilldowns: WorkforceDrilldownDescriptor[];
  metadata: WorkforceViewModelMetadata;
}

/** Optional public-code index: internal id (string) → public code. */
export interface WorkforceOrgPublicIndex {
  regionById: Readonly<Record<string, string>>;
  divisionById: Readonly<Record<string, string>>;
  companyById: Readonly<Record<string, string>>;
  regionLabelByCode?: Readonly<Record<string, string>>;
  divisionLabelByCode?: Readonly<Record<string, string>>;
  companyLabelByCode?: Readonly<Record<string, string>>;
}

export interface WorkforceScope {
  regionPublicCode?: string | null;
  divisionPublicCode?: string | null;
  companyPublicCode?: string | null;
  labelTh?: string | null;
}
