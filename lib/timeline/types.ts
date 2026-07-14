/**
 * Unified Personnel Timeline Engine domain types.
 *
 * Pure contracts only: no React, no database, no API calls.
 */

import type { PromotionEvaluationResult } from "@/lib/promotion";
import type { SalaryStepEvaluationResult, SalaryStepHistoryRecord } from "@/lib/salary_step";

export type TimelineEventType =
  | "OFFICER_CREATED"
  | "GOVERNMENT_SERVICE_STARTED"
  | "PROMOTION"
  | "RANK_CHANGE"
  | "POSITION_CHANGE"
  | "SALARY_STEP"
  | "TRAINING"
  | "AWARD"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_UPDATED"
  | "OFFICIAL_PORTRAIT_UPDATED"
  | "ORGANIZATION_CHANGED"
  | "RETIREMENT_ELIGIBLE"
  | "RETIREMENT"
  | "COMMANDER_NOTE"
  | "MANUAL_EVENT"
  | "FUTURE_EVENT"
  | "UPCOMING_ELIGIBILITY";

export type TimelineCategory =
  | "career"
  | "promotion"
  | "salary"
  | "training"
  | "award"
  | "document"
  | "portrait"
  | "organization"
  | "retirement"
  | "system"
  | "manual";

export type TimelineSeverity = "info" | "success" | "warning" | "critical" | "neutral";

export type TimelineSource =
  | "officer"
  | "career_timeline"
  | "promotion_engine"
  | "personnel_calendar"
  | "salary_step_engine"
  | "training"
  | "award"
  | "document"
  | "portrait"
  | "commander"
  | "manual"
  | "system";

export interface TimelineOfficerRef {
  officerId: string;
  displayName?: string | null;
  rank?: string | null;
  organization?: string | null;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: Date;
  title: string;
  description?: string;
  category: TimelineCategory;
  severity: TimelineSeverity;
  source: TimelineSource;
  officer: TimelineOfficerRef;
  metadata?: Readonly<Record<string, unknown>>;
  future: boolean;
  past: boolean;
}

export interface TimelineCareerRecord {
  id: string | number;
  date: Date | null;
  rank?: string | null;
  position?: string | null;
  unit?: string | null;
  organization?: string | null;
  source?: string | null;
  isPresent?: boolean;
}

export interface TimelineTrainingRecord {
  id: string | number;
  title: string;
  date?: Date | null;
  year?: string | number | null;
  organization?: string | null;
  expiresAt?: Date | null;
}

export interface TimelineAwardRecord {
  id: string | number;
  title: string;
  date?: Date | null;
  awardedAt?: Date | null;
  remarks?: string | null;
}

export interface TimelineDocumentRecord {
  id: string | number;
  documentType: string;
  title: string;
  uploadedAt?: Date | null;
  updatedAt?: Date | null;
  verifiedAt?: Date | null;
  isActive?: boolean;
  expiresAt?: Date | null;
}

export interface TimelinePortraitRecord {
  id: string | number;
  updatedAt?: Date | null;
  createdAt?: Date | null;
  title?: string | null;
  isOfficial?: boolean;
}

export interface TimelineManualEventInput {
  id: string;
  date: Date;
  title: string;
  description?: string;
  category?: TimelineCategory;
  severity?: TimelineSeverity;
  source?: TimelineSource;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface TimelineBuilderInput {
  officer: TimelineOfficerRef & {
    createdAt?: Date | null;
    dateOfBirth?: Date | null;
    governmentServiceStartDate?: Date | null;
  };
  asOf?: Date;
  career?: readonly TimelineCareerRecord[];
  promotionResult?: PromotionEvaluationResult | null;
  salaryHistory?: readonly SalaryStepHistoryRecord[];
  salaryStepResult?: SalaryStepEvaluationResult | null;
  training?: readonly TimelineTrainingRecord[];
  awards?: readonly TimelineAwardRecord[];
  documents?: readonly TimelineDocumentRecord[];
  portraits?: readonly TimelinePortraitRecord[];
  manualEvents?: readonly TimelineManualEventInput[];
  futureEvents?: readonly TimelineManualEventInput[];
}

export interface Timeline {
  officer: TimelineOfficerRef;
  events: TimelineEvent[];
  summary: TimelineSummary;
}

export interface TimelineSummary {
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  promotionEvents: number;
  trainingEvents: number;
  salaryEvents: number;
  documentEvents: number;
}

export interface TimelineFilter {
  startDate?: Date;
  endDate?: Date;
  category?: TimelineCategory | readonly TimelineCategory[];
  severity?: TimelineSeverity | readonly TimelineSeverity[];
  futureOnly?: boolean;
  pastOnly?: boolean;
  source?: TimelineSource | readonly TimelineSource[];
  officerId?: string;
  organization?: string;
}
