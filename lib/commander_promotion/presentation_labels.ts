/**
 * Presentation labels for Commander Promotion Intelligence (Phase 52.2.2).
 * Does not change Promotion Engine classification or PromotionSummary computation.
 */
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { ExecutiveBucket, PresentationBucket } from "@/lib/commander_promotion/types";

/** Canonical executive buckets remain mutually exclusive row classifications. */
export const EXECUTIVE_BUCKET_LABEL_TH: Record<ExecutiveBucket, string> = {
  eligibleThisYear: "พร้อมเลื่อนปีนี้",
  alreadyEligible: "ครบคุณสมบัติก่อนปีนี้",
  nextYear: "จะครบในปีหน้า",
  notYetEligible: "ยังไม่ครบคุณสมบัติ",
  incomplete: "ข้อมูลไม่สมบูรณ์",
  noTarget: "ไม่มีระดับเป้าหมาย",
};

/** Presentation-only aggregate — not a row executiveBucket value. */
export const QUALIFIED_NOW_BUCKET = "qualifiedNow" as const;
export const QUALIFIED_NOW_LABEL_TH = "ผู้มีคุณสมบัติครบทั้งหมด";

export const PRESENTATION_BUCKET_LABEL_TH: Record<PresentationBucket, string> = {
  ...EXECUTIVE_BUCKET_LABEL_TH,
  qualifiedNow: QUALIFIED_NOW_LABEL_TH,
};

/** Table/status chip labels — overlays engine displayStatusTh for executive clarity. */
export const CPI_STATUS_LABEL_TH: Record<PromotionEligibilityStatus, string> = {
  EligibleThisYear: "พร้อมเลื่อนปีนี้",
  AlreadyEligible: "ครบคุณสมบัติก่อนปีนี้",
  Waiting: "อยู่ระหว่างรอ",
  MissingTraining: "ขาดหลักสูตร",
  MissingDocuments: "ขาดเอกสาร",
  RetirementRestricted: "จำกัดจากการเกษียณ",
  NotEligible: "ยังไม่ถึงเกณฑ์",
  Unknown: "ไม่ทราบข้อมูล",
};

export function presentationBucketLabelTh(bucket: PresentationBucket): string {
  return PRESENTATION_BUCKET_LABEL_TH[bucket];
}

export function cpiStatusLabelTh(status: PromotionEligibilityStatus): string {
  return CPI_STATUS_LABEL_TH[status];
}

export function isQualifiedNowBucket(bucket: PresentationBucket | null | undefined): boolean {
  return bucket === QUALIFIED_NOW_BUCKET;
}

export function isPresentationBucket(value: string | null | undefined): value is PresentationBucket {
  return value != null && value in PRESENTATION_BUCKET_LABEL_TH;
}
