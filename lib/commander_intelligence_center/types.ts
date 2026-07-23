/**
 * Commander Intelligence Center — view model types (Phase 49B).
 *
 * Pure type declarations only — no logic, no I/O, no React. Every field here
 * is sourced from an already-computed engine output (CommanderQueryDataset,
 * CommanderDashboardViewModel, CommanderDashboard/OfficerIntelligenceCard) —
 * this module composes/aggregates, it does not introduce new business rules
 * or scoring.
 */
import type { OfficerFlagCode, OfficerPriority } from "@/lib/intelligence";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";

export type CommanderKpiId =
  | "personnel"
  | "readyForPromotion"
  | "promotionOverdue"
  | "retiringWithin12Months"
  | "documentsMissing"
  | "trainingMissing"
  | "profileIncomplete"
  | "expiredDocuments"
  | "criticalOfficers"
  | "aiReady";

export interface CommanderKpiCardViewModel {
  id: CommanderKpiId;
  value: number;
  /** Search query string appended to "/commander-search" — null when the KPI has nothing meaningful to filter on (never a dead link disguised as clickable). */
  href: string | null;
}

/** The four priority buckets — read directly from OfficerIntelligenceCard.priority (lib/intelligence's existing scoring), never recomputed. */
export type PriorityBucketKey = OfficerPriority;

export const PRIORITY_BUCKET_ORDER: readonly PriorityBucketKey[] = ["critical", "high", "medium", "low"];

export interface PriorityMatrixOfficerRow {
  officerId: string;
  displayName: string;
  rank: string | null;
  flagCodes: OfficerFlagCode[];
  href: string;
}

export interface PriorityMatrixBucket {
  key: PriorityBucketKey;
  count: number;
  href: string;
  officers: PriorityMatrixOfficerRow[];
}

export type CommanderActionCenterActionId =
  | "approvePromotionCandidates"
  | "reviewMissingDocuments"
  | "reviewExpiringIds"
  | "reviewMissingTraining"
  | "reviewIncompleteProfiles";

export interface CommanderActionCenterItemViewModel {
  id: CommanderActionCenterActionId;
  count: number;
  href: string | null;
}

export type CommanderTimelineEventKind = "birthday" | "retirement" | "promotionEligibility" | "documentExpiry" | "trainingExpiry";
export type CommanderTimelineHorizon = 30 | 60 | 90;

export interface CommanderTimelineEvent {
  kind: CommanderTimelineEventKind;
  officerId: string;
  displayName: string;
  /** Whole days from `asOf` to the event (0 = today). Never negative — past events are not shown on a forward-looking timeline. */
  daysUntil: number;
  /** Already-localized Thai detail text sourced from the owning engine's own display field (e.g. RetirementSummary.displayRetirementDateTh) — never rebuilt here. */
  detailTh: string;
  href: string;
}

export interface CommanderTimelineBucket {
  horizon: CommanderTimelineHorizon;
  events: CommanderTimelineEvent[];
}

export interface ExecutiveTableRow {
  officerId: string;
  officialPortraitUrl: string | null;
  rank: string | null;
  displayName: string;
  currentUnit: string | null;
  currentPosition: string | null;
  promotionStatus: PromotionEligibilityStatus;
  displayPromotionStatusTh: string;
  retirementYearBe: number | null;
  readinessLevel: string;
  missingDocumentsCount: number;
  trainingStatusTh: string;
  priority: PriorityBucketKey;
  /** The single most urgent next action, in Thai — sourced from the officer's existing documentIntelligence.primaryActionLabelTh (never a newly-invented label). */
  nextActionTh: string;
  href: string;
}

export interface ExecutiveSummaryViewModel {
  /** "วันนี้มีกำลังพลที่ควรดำเนินการเร่งด่วน 14 นาย" */
  headlineTh: string;
  /** e.g. ["ครบคุณสมบัติเลื่อนตำแหน่ง 6 นาย", "เอกสารหมดอายุ 3 นาย", ...] — only non-zero lines are included. */
  bulletsTh: string[];
  urgentOfficerCount: number;
}

export interface CommanderIntelligenceCenterViewModel {
  generatedAtIso: string;
  kpis: CommanderKpiCardViewModel[];
  priorityMatrix: PriorityMatrixBucket[];
  actionCenter: CommanderActionCenterItemViewModel[];
  timeline: CommanderTimelineBucket[];
  executiveTable: ExecutiveTableRow[];
  executiveSummary: ExecutiveSummaryViewModel;
}
