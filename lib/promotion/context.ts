/**
 * Promotion evaluation context.
 *
 * The context intentionally accepts broad optional inputs so future modules
 * can attach data without changing the engine contract.
 */

import {
  calculateAge,
  calculateGovernmentServiceDuration,
  calculateRetirement,
  type DurationYMD,
} from "@/lib/personnel_calendar";

export interface PromotionTrainingRecord {
  code: string;
  completedAt?: Date | null;
}

export interface PromotionEducationRecord {
  level?: string | null;
  degree?: string | null;
  graduatedAt?: Date | null;
}

export interface PromotionAwardRecord {
  code: string;
  awardedAt?: Date | null;
}

export interface PromotionDocumentRecord {
  typeCode: string;
  isActive?: boolean;
  verifiedAt?: Date | null;
}

export interface PromotionEvaluationContext {
  asOf: Date;
  currentRank?: string | null;
  currentPosition?: string | null;
  governmentServiceStartDate?: Date | null;
  dateOfBirth?: Date | null;
  age?: DurationYMD | null;
  governmentServiceDuration?: DurationYMD | null;
  timeInCurrentRank?: DurationYMD | null;
  retirementDate?: Date | null;
  remainingUntilRetirement?: DurationYMD | null;
  trainingRecords?: readonly PromotionTrainingRecord[];
  educationRecords?: readonly PromotionEducationRecord[];
  awardRecords?: readonly PromotionAwardRecord[];
  disciplinaryStatus?: string | null;
  documents?: readonly PromotionDocumentRecord[];
  extensions?: Readonly<Record<string, unknown>>;
}

export interface BuildPromotionContextInput
  extends Omit<
    PromotionEvaluationContext,
    "asOf" | "age" | "governmentServiceDuration" | "retirementDate" | "remainingUntilRetirement"
  > {
  asOf?: Date;
}

export function buildPromotionContext(input: BuildPromotionContextInput): PromotionEvaluationContext {
  const asOf = input.asOf ?? new Date();
  const retirement = calculateRetirement(input.dateOfBirth, asOf);

  return {
    ...input,
    asOf,
    age: calculateAge(input.dateOfBirth, asOf),
    governmentServiceDuration: calculateGovernmentServiceDuration(input.governmentServiceStartDate, asOf),
    retirementDate: retirement?.retirementDate ?? null,
    remainingUntilRetirement: retirement?.remaining ?? null,
  };
}
