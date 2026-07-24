/**
 * Commander Promotion Intelligence Dashboard types (Phase 50).
 * Pure data — no I/O, no React.
 */
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { MissingEvidenceKey } from "@/lib/promotion/eligibility_policy";
import type { ReadinessBand } from "@/lib/commander_promotion/readiness";

export type ExecutiveBucket =
  | "noTarget"
  | "incomplete"
  | "eligibleThisYear"
  | "alreadyEligible"
  | "nextYear"
  | "notYetEligible";

export type ExecutivePriorityBand = "Critical" | "High" | "Medium" | "Low";

export type RetirementWindow = "within1" | "within3" | "within5" | "beyond" | "unknown";

export type BlockerKey =
  | "MissingTraining"
  | "MissingDocuments"
  | "RetirementRestricted"
  | "missingLevelStart"
  | "noTarget"
  | "Unknown";

export type ActionUrgency = "Critical" | "High" | "Normal" | "Informational";

export interface PreparedPromotionRow {
  officerId: string;
  profileHref: string;
  portraitUrl: string | null;
  rankLabel: string;
  fullName: string;
  searchText: string;

  regionKey: string | null;
  regionLabel: string;
  divisionKey: string | null;
  divisionLabel: string;
  companyKey: string | null;
  companyLabel: string;

  currentPositionLabel: string;
  currentPositionLevel: string | null;
  targetPositionLabel: string | null;
  targetPositionLevel: string | null;
  positionLevelStartYearBe: number | null;

  completedTenureYears: number | null;
  requiredTenureYears: number | null;
  remainingTenureYears: number | null;
  remainingTenureLabel: string;
  readinessPercent: number | null;
  readinessBand: ReadinessBand;

  promotionStatus: PromotionEligibilityStatus;
  executiveBucket: ExecutiveBucket;
  firstEligibleYearBe: number | null;
  appointmentYearBe: number;
  cycleLabel: string | null;
  ordinalLabel: string | null;
  overdueYears: number | null;
  recommendedActionTh: string;
  statusLabelTh: string;

  priorityBand: ExecutivePriorityBand;
  priorityOrder: number;

  retirementYearBe: number | null;
  retirementRemainingYears: number | null;
  retirementWindow: RetirementWindow;
  hasUnknownRetirement: boolean;

  blockerKeys: BlockerKey[];
  missingEvidence: MissingEvidenceKey[];
  hasMissingDocuments: boolean;
  hasMissingTraining: boolean;
  hasUnknownPositionHistory: boolean;
  isPromotionReady: boolean;
  isBlocked: boolean;
}

export interface CountDrilldown {
  key: string;
  labelTh: string;
  count: number;
  filter: Partial<CommanderPromotionFilterState>;
  topNames: string[];
}

export interface ExecutiveSummaryView {
  appointmentYearBe: number;
  eligibleThisYearCount: number;
  alreadyEligibleCount: number;
  nextYearCount: number;
  incompleteCount: number;
  urgentSummaryTh: string;
}

export interface KpiCardView {
  bucket: ExecutiveBucket;
  labelTh: string;
  count: number;
}

export interface DistributionSlice {
  key: string;
  labelTh: string;
  count: number;
}

export interface OrgComparisonRow {
  level: "region" | "division" | "company";
  key: string;
  labelTh: string;
  parentKey: string | null;
  total: number;
  eligibleThisYear: number;
  alreadyEligible: number;
  nextYear: number;
  incomplete: number;
  blocked: number;
  promotionReady: number;
  averageReadiness: number | null;
  knownReadinessCount: number;
  criticalCount: number;
  highCount: number;
  retirementCollisionCount: number;
  topPriorityNames: string[];
  filter: Partial<CommanderPromotionFilterState>;
}

export interface RetirementCollisionView {
  within1: CountDrilldown;
  within3: CountDrilldown;
  within5: CountDrilldown;
}

export interface WatchlistCategoryView {
  key: string;
  labelTh: string;
  count: number;
  topNames: string[];
  filter: Partial<CommanderPromotionFilterState>;
}

export interface ForecastBucketView {
  yearBe: number;
  labelTh: string;
  count: number;
}

export interface TimelineYearView {
  yearBe: number;
  count: number;
  eligibleThisYear: number;
  alreadyEligible: number;
  nextYear: number;
  incomplete: number;
}

export interface QueueItemView {
  officerId: string;
  profileHref: string;
  portraitUrl: string | null;
  priorityBand: ExecutivePriorityBand;
  rankLabel: string;
  fullName: string;
  currentPositionLabel: string;
  targetPositionLabel: string | null;
  statusLabelTh: string;
  recommendedActionTh: string;
}

export interface ActionItemView {
  id: string;
  urgency: ActionUrgency;
  labelTh: string;
  descriptionTh: string;
  count: number;
  filter: Partial<CommanderPromotionFilterState>;
}

export interface InsightCardView {
  id: string;
  titleTh: string;
  detailTh: string;
  filter?: Partial<CommanderPromotionFilterState>;
}

export interface DataQualityCardView {
  key: string;
  labelTh: string;
  explanationTh: string;
  count: number;
  severity: "serious" | "warning" | "neutral";
  filter: Partial<CommanderPromotionFilterState>;
}

export interface DashboardQuickStatsView {
  averageReadiness: number | null;
  knownReadinessCount: number;
  medianRemainingYears: number | null;
  highestReadyOrgLabel: string | null;
  largestBlockerLabel: string | null;
  promotionReadyPercent: number | null;
  totalRows: number;
  promotionReadyCount: number;
}

export interface FilterOptionsView {
  regions: Array<{ key: string; label: string }>;
  divisions: Array<{ key: string; label: string; regionKey: string | null }>;
  companies: Array<{ key: string; label: string; divisionKey: string | null }>;
  ranks: string[];
  currentPositions: string[];
  targetPositions: string[];
  eligibleYears: number[];
}

export interface CommanderPromotionFilterState {
  regionKey: string | null;
  divisionKey: string | null;
  companyKey: string | null;
  rank: string | null;
  currentPosition: string | null;
  targetPosition: string | null;
  promotionStatus: PromotionEligibilityStatus | null;
  bucket: ExecutiveBucket | null;
  priority: ExecutivePriorityBand | null;
  readinessBand: ReadinessBand | null;
  eligibleYear: number | null;
  /** Inclusive lower bound for firstEligibleYearBe (horizon filters). */
  eligibleYearMin: number | null;
  /** Inclusive upper bound for firstEligibleYearBe (horizon filters). */
  eligibleYearMax: number | null;
  retirementWindow: RetirementWindow | null;
  blocker: BlockerKey | null;
  dataQuality: string | null;
  /** When true, EligibleThisYear ∪ AlreadyEligible (watchlist / collision helpers). */
  promotionReadyOnly: boolean | null;
  search: string;
}

export const EMPTY_PROMOTION_FILTER: CommanderPromotionFilterState = {
  regionKey: null,
  divisionKey: null,
  companyKey: null,
  rank: null,
  currentPosition: null,
  targetPosition: null,
  promotionStatus: null,
  bucket: null,
  priority: null,
  readinessBand: null,
  eligibleYear: null,
  eligibleYearMin: null,
  eligibleYearMax: null,
  retirementWindow: null,
  blocker: null,
  dataQuality: null,
  promotionReadyOnly: null,
  search: "",
};

export interface CommanderPromotionViewModel {
  generatedAtIso: string;
  appointmentYearBe: number;
  totalOfficers: number;
  rows: PreparedPromotionRow[];
  executiveSummary: ExecutiveSummaryView;
  kpis: KpiCardView[];
  readinessDistribution: DistributionSlice[];
  blockingFactors: CountDrilldown[];
  priorityDistribution: DistributionSlice[];
  organizationComparison: OrgComparisonRow[];
  retirementCollisions: RetirementCollisionView;
  upcomingHorizons: Array<CountDrilldown & { horizonYears: 1 | 2 | 3 }>;
  workloadForecast: ForecastBucketView[];
  timelineByYear: TimelineYearView[];
  promotionQueue: QueueItemView[];
  actionCenter: ActionItemView[];
  commanderInsights: InsightCardView[];
  dataQuality: DataQualityCardView[];
  executiveWatchlist: WatchlistCategoryView[];
  dashboardQuickStats: DashboardQuickStatsView;
  filterOptions: FilterOptionsView;
}

export const EXECUTIVE_BUCKET_LABEL_TH: Record<ExecutiveBucket, string> = {
  eligibleThisYear: "ครบคุณสมบัติในปีนี้",
  alreadyEligible: "ครบคุณสมบัติมาแล้ว",
  nextYear: "จะครบในปีหน้า",
  notYetEligible: "ยังไม่ครบคุณสมบัติ",
  incomplete: "ข้อมูลไม่สมบูรณ์",
  noTarget: "ไม่มีระดับเป้าหมาย",
};

export const PRIORITY_LABEL_TH: Record<ExecutivePriorityBand, string> = {
  Critical: "วิกฤต",
  High: "สูง",
  Medium: "ปานกลาง",
  Low: "ต่ำ",
};

export const BLOCKER_LABEL_TH: Record<BlockerKey, string> = {
  MissingTraining: "ขาดหลักสูตร",
  MissingDocuments: "ขาดเอกสาร",
  RetirementRestricted: "ข้อจำกัดก่อนเกษียณ",
  missingLevelStart: "ไม่มีปีเริ่มดำรงระดับ",
  noTarget: "ไม่มีระดับเป้าหมาย",
  Unknown: "ประเมินไม่ได้",
};
