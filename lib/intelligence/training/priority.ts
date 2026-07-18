/**
 * Commander Training Priority (Phase 45, Task 12).
 *
 * A deterministic, rule-ordered list — NOT an AI recommendation, NOT a
 * numerical score (the task explicitly forbids inventing one without a
 * real policy). Ordering is a fixed rule sequence:
 *   1. missing required training AND promotion-eligible this year/already eligible
 *   2. expired required qualification
 *   3. expiring soon (any officer)
 *   4. unverified training that blocks analysis
 *   5. no training data
 * Officers matching none of the above are omitted — this is a PRIORITY
 * list, not a full roster.
 *
 * Pure — no I/O, no React.
 */
import type { TrainingSummary } from "@/lib/intelligence/training/types";

export interface TrainingPriorityOfficer {
  officerId: string;
  displayName: string;
  rank: string | null;
  position: string | null;
  unit: string | null;
  officialPortraitUrl: string | null;
  trainingStatus: TrainingSummary["trainingStatus"];
  missingCourseNames: string[];
  expiringCourseNames: string[];
  promotionStatusTh: string | null;
  recommendedActionTh: string;
}

export interface TrainingPriorityInput {
  officerId: string;
  displayName: string;
  rank: string | null;
  position: string | null;
  unit: string | null;
  officialPortraitUrl: string | null;
  training: TrainingSummary;
  /** The officer's PromotionSummary.promotionStatus — used only to detect the "promotion-eligible" ordering tier, never re-evaluated. */
  promotionEligible: boolean;
  promotionStatusTh: string | null;
}

/** Fixed rule-tier order — lower number sorts first. Returns null (excluded from the list) when no tier matches. */
function priorityTier(input: TrainingPriorityInput): number | null {
  const { training, promotionEligible } = input;
  if (training.trainingStatus === "MissingRequired" && promotionEligible) return 1;
  if (training.trainingStatus === "Expired") return 2;
  if (training.trainingStatus === "ExpiringSoon") return 3;
  if (training.trainingStatus === "Unverified") return 4;
  if (training.trainingStatus === "NoData") return 5;
  return null;
}

function recommendedActionFor(tier: number): string {
  switch (tier) {
    case 1:
      return "เสนอเข้ารับการอบรมก่อนพิจารณาเลื่อนตำแหน่ง";
    case 2:
      return "จัดให้เข้ารับการอบรมทบทวนโดยเร็ว หลักสูตรหมดอายุแล้ว";
    case 3:
      return "วางแผนอบรมทบทวนก่อนหลักสูตรหมดอายุ";
    case 4:
      return "ตรวจสอบและยืนยันข้อมูลหลักสูตรที่ยังไม่ตรวจสอบ";
    default:
      return "จัดเก็บข้อมูลการฝึกอบรมของกำลังพลรายนี้";
  }
}

/**
 * Builds the deterministic Commander Training Priority list. Same-tier
 * officers keep their input order (stable sort) — no secondary numeric
 * scoring is invented.
 */
export function buildTrainingPriorityList(officers: readonly TrainingPriorityInput[]): TrainingPriorityOfficer[] {
  const withTier = officers
    .map((officer) => ({ officer, tier: priorityTier(officer) }))
    .filter((entry): entry is { officer: TrainingPriorityInput; tier: number } => entry.tier !== null);

  withTier.sort((a, b) => a.tier - b.tier);

  return withTier.map(({ officer, tier }) => ({
    officerId: officer.officerId,
    displayName: officer.displayName,
    rank: officer.rank,
    position: officer.position,
    unit: officer.unit,
    officialPortraitUrl: officer.officialPortraitUrl,
    trainingStatus: officer.training.trainingStatus,
    missingCourseNames: officer.training.missingRequirements.map((r) => r.displayNameTh),
    expiringCourseNames: officer.training.expiringSoon.map((r) => r.displayNameTh),
    promotionStatusTh: officer.promotionStatusTh,
    recommendedActionTh: recommendedActionFor(tier),
  }));
}
