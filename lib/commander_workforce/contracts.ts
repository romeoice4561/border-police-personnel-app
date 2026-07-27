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

/**
 * Executive presentation labels for PromotionSummary.promotionStatus.
 * Classification stays mutually exclusive — labels only (Phase 52.2.2).
 */
export const WORKFORCE_PROMOTION_LABEL_TH: Record<WorkforcePromotionStatus, string> = {
  EligibleThisYear: "พร้อมเลื่อนปีนี้",
  AlreadyEligible: "ครบคุณสมบัติก่อนปีนี้",
  Waiting: "อยู่ระหว่างรอ",
  MissingTraining: "ขาดหลักสูตร",
  MissingDocuments: "ขาดเอกสาร",
  RetirementRestricted: "จำกัดจากการเกษียณ",
  NotEligible: "ยังไม่ถึงเกณฑ์",
  Unknown: "ไม่ทราบข้อมูล",
};

export const WORKFORCE_PROMOTION_DESCRIPTION_TH: Record<WorkforcePromotionStatus, string> = {
  EligibleThisYear: "ครบคุณสมบัติครั้งแรกในปีพิจารณานี้",
  AlreadyEligible: "ครบคุณสมบัติมาแล้วก่อนปีนี้ และยังไม่ได้รับการแต่งตั้ง",
  Waiting: "ยังอยู่ระหว่างรอครบคุณสมบัติ",
  MissingTraining: "ติดขัดด้านหลักสูตร",
  MissingDocuments: "ติดขัดด้านเอกสาร",
  RetirementRestricted: "ถูกจำกัดเนื่องจากใกล้เกษียณ",
  NotEligible: "ยังไม่ถึงเกณฑ์คุณสมบัติ",
  Unknown: "ยังประเมินสถานะไม่ได้",
};

/** Presentation aggregate — not a PromotionEligibilityStatus. */
export const WORKFORCE_QUALIFIED_NOW_LABEL_TH = "ผู้มีคุณสมบัติครบทั้งหมด";


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
