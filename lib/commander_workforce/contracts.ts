/**
 * Input / composer contracts for Workforce Intelligence (Phase 52.1).
 */

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type {
  CommanderWorkforceViewModel,
  WorkforceFilterState,
  WorkforceOrgPublicIndex,
  WorkforceScope,
} from "@/lib/commander_workforce/types";

export interface ComposeCommanderWorkforceInput {
  officers: readonly CommanderQueryOfficer[];
  asOfDate: Date | string;
  scope?: WorkforceScope;
  filters?: Partial<WorkforceFilterState>;
  /** Maps internal org FKs → public codes. When omitted, org public-code filters are empty. */
  orgPublicIndex?: WorkforceOrgPublicIndex;
  /** Optional wall-clock for metadata only — does not affect tallies. */
  now?: Date;
}

export type ComposeCommanderWorkforceViewModel = (
  input: ComposeCommanderWorkforceInput
) => CommanderWorkforceViewModel;

export const EMPTY_WORKFORCE_FILTERS: WorkforceFilterState = {
  regionPublicCode: null,
  divisionPublicCode: null,
  companyPublicCode: null,
  rank: null,
  positionLevel: null,
  promotionStatus: null,
  retirementWindow: null,
  trainingStatus: null,
  documentStatus: null,
  dataQualityStatus: null,
  search: null,
};

/** Canonical promotion statuses — exact PromotionEligibilityStatus names. */
export const WORKFORCE_PROMOTION_STATUSES = [
  "EligibleThisYear",
  "AlreadyEligible",
  "Waiting",
  "MissingTraining",
  "MissingDocuments",
  "RetirementRestricted",
  "NotEligible",
  "Unknown",
] as const;

export type WorkforcePromotionStatus = (typeof WORKFORCE_PROMOTION_STATUSES)[number];

/** Matches PROMOTION_STATUS_DISPLAY_TH (lib/intelligence/promotion) — labels only, no engine import. */
export const WORKFORCE_PROMOTION_LABEL_TH: Record<WorkforcePromotionStatus, string> = {
  EligibleThisYear: "ครบคุณสมบัติในปีนี้",
  AlreadyEligible: "มีคุณสมบัติครบมาแล้ว",
  Waiting: "ยังไม่ครบคุณสมบัติ",
  MissingTraining: "ขาดคุณสมบัติด้านการฝึกอบรม",
  MissingDocuments: "ขาดเอกสารประกอบการพิจารณา",
  RetirementRestricted: "ใกล้เกษียณอายุราชการ",
  NotEligible: "ยังไม่ครบคุณสมบัติ",
  Unknown: "ไม่สามารถประเมินได้",
};

export const WORKFORCE_PROMOTION_DESCRIPTION_TH: Record<WorkforcePromotionStatus, string> = {
  EligibleThisYear: "สถานะ PromotionSummary.EligibleThisYear",
  AlreadyEligible: "สถานะ PromotionSummary.AlreadyEligible",
  Waiting: "สถานะ PromotionSummary.Waiting",
  MissingTraining: "สถานะ PromotionSummary.MissingTraining",
  MissingDocuments: "สถานะ PromotionSummary.MissingDocuments",
  RetirementRestricted: "สถานะ PromotionSummary.RetirementRestricted",
  NotEligible: "สถานะ PromotionSummary.NotEligible",
  Unknown: "สถานะ PromotionSummary.Unknown",
};

export const WORKFORCE_RETIREMENT_WINDOWS = [
  "this_fiscal_year",
  "within_1_year",
  "within_3_years",
  "within_5_years",
  "beyond_5_years",
  "already_retired",
  "unknown",
] as const;

export const WORKFORCE_RETIREMENT_LABEL_TH: Record<(typeof WORKFORCE_RETIREMENT_WINDOWS)[number], string> = {
  this_fiscal_year: "เกษียณปีงบประมาณนี้",
  within_1_year: "ภายใน 1 ปี",
  within_3_years: "ภายใน 3 ปี",
  within_5_years: "ภายใน 5 ปี",
  beyond_5_years: "เกิน 5 ปี",
  already_retired: "เกษียณแล้ว",
  unknown: "ไม่ทราบปีเกษียณ",
};

/** Equal weights among available readiness dimensions — explicit and visible. */
export const READINESS_EQUAL_WEIGHT = 1;

export const COMMAND_POSITION_LEVELS = new Set([
  "ผู้กำกับการ",
  "รองผู้บังคับการ",
  "ผู้บังคับการ",
  "รองผู้บัญชาการ",
]);
