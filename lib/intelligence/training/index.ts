/**
 * Training Intelligence Engine — public API (Phase 45).
 *
 * Master Data (Training rows) -> THIS module -> Commander/Officer view
 * models -> UI. The single place that turns an officer's factual training
 * records plus a configured TrainingPolicy into a commander-ready
 * TrainingSummary. No React component may recalculate any of this.
 *
 * `computeTrainingSummary` is intentionally pure (no I/O) — callers load
 * the officer's `Training[]` and resolve the officer's target position
 * level, then call this function. See docs/TRAINING_INTELLIGENCE.md for
 * the full data flow and known limitations (no completion date, no expiry,
 * no certificate number, no verification field on `Training` today).
 */
import type { Training } from "@/lib/database/query_types";
import { toTrainingRecordEvidenceBatch } from "@/lib/intelligence/training/evidence";
import { detectDataQualityFlags } from "@/lib/intelligence/training/data_quality";
import { evaluateRequirements } from "@/lib/intelligence/training/requirement_evaluation";
import { trainingPoliciesForTargetLevel } from "@/lib/intelligence/training/policy";
import { TRAINING_STATUS_DISPLAY_TH } from "@/lib/intelligence/training/display";
import type { TrainingRequirementResult, TrainingStatus, TrainingSummary } from "@/lib/intelligence/training/types";

export type { TrainingSummary, TrainingRecordEvidence, TrainingRequirementResult, TrainingRequirementStatus, TrainingStatus, TrainingDataQualityFlag, ExpirySummary, ExpiryBand } from "@/lib/intelligence/training/types";
export { TRAINING_STATUS_DISPLAY_TH, TRAINING_REQUIREMENT_STATUS_DISPLAY_TH } from "@/lib/intelligence/training/display";
export type { TrainingPolicy } from "@/lib/intelligence/training/policy";
export { TRAINING_POLICIES, trainingPoliciesForTargetLevel, hasTrainingPolicyForTargetLevel } from "@/lib/intelligence/training/policy";
export { normalizeCourseName, COURSE_ALIAS_MAP } from "@/lib/intelligence/training/course_normalization";
export { computeExpirySummary } from "@/lib/intelligence/training/expiry";

function dateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function recommendationsFor(status: TrainingStatus, missing: readonly TrainingRequirementResult[], expiring: readonly TrainingRequirementResult[], expired: readonly TrainingRequirementResult[]): string[] {
  const recommendations: string[] = [];
  if (status === "MissingRequired") {
    recommendations.push("เสนอเข้ารับการอบรมก่อนพิจารณาเลื่อนตำแหน่ง");
    for (const requirement of missing) {
      recommendations.push(`ขาดหลักสูตร: ${requirement.displayNameTh}`);
    }
  }
  if (status === "Expired") {
    for (const requirement of expired) {
      recommendations.push(`หลักสูตรหมดอายุ ควรอบรมทบทวน: ${requirement.displayNameTh}`);
    }
  }
  if (status === "ExpiringSoon") {
    for (const requirement of expiring) {
      recommendations.push(`หลักสูตรใกล้หมดอายุ ควรอบรมทบทวน: ${requirement.displayNameTh}`);
    }
  }
  return recommendations;
}

/**
 * Composes the full Training Intelligence summary for one officer.
 * `targetPositionLevel` is the officer's NEXT position level (the same
 * value Promotion Intelligence evaluates against) — null when not
 * applicable (Unknown level / top of scope), in which case the summary
 * reports `NoPolicy` (there is nothing to require training FOR) rather
 * than silently omitting the field. `asOf` is deterministic — never
 * `new Date()` inside this function; callers pass an explicit value.
 */
export function computeTrainingSummary(trainingRows: readonly Training[], targetPositionLevel: string | null, asOf: Date): TrainingSummary {
  const asOfDate = dateOnlyIso(asOf);
  const evidence = toTrainingRecordEvidenceBatch(trainingRows);
  const dataQualityFlags = detectDataQualityFlags(evidence);

  const totalRecords = evidence.length;
  const verifiedRecords = evidence.filter((record) => record.verified === true).length;
  const unverifiedRecords = evidence.filter((record) => record.verified === false || record.verified === null).length;

  const policies = targetPositionLevel ? trainingPoliciesForTargetLevel(targetPositionLevel) : [];
  const requiredCourseKeys = policies.flatMap((policy) => policy.requiredCourseKeys);

  if (requiredCourseKeys.length === 0) {
    // NoPolicy: no real, curator-configured requirement exists for this
    // officer's target level. Never reinterpreted as MissingTraining.
    const trainingStatus: TrainingStatus = totalRecords === 0 ? "NoData" : "NoPolicy";
    return {
      available: true,
      asOfDate,
      totalRecords,
      verifiedRecords,
      unverifiedRecords,
      completedCourseCount: totalRecords,
      missingRequiredCourseCount: 0,
      expiringSoonCount: 0,
      expiredCount: 0,
      requiredRequirements: [],
      completedCourses: evidence,
      missingRequirements: [],
      expiringSoon: [],
      expired: [],
      trainingStatus,
      displayStatusTh: TRAINING_STATUS_DISPLAY_TH[trainingStatus],
      recommendationsTh: [],
      dataQualityFlags,
    };
  }

  const requirements = evaluateRequirements(requiredCourseKeys, evidence, asOf);
  const missingRequirements = requirements.filter((r) => r.status === "Missing");
  const expiringSoon = requirements.filter((r) => r.status === "ExpiringSoon");
  const expired = requirements.filter((r) => r.status === "Expired");
  const unverifiedRequirements = requirements.filter((r) => r.status === "Unverified");

  let trainingStatus: TrainingStatus;
  if (missingRequirements.length > 0) trainingStatus = "MissingRequired";
  else if (expired.length > 0) trainingStatus = "Expired";
  else if (expiringSoon.length > 0) trainingStatus = "ExpiringSoon";
  else if (unverifiedRequirements.length > 0) trainingStatus = "Unverified";
  else trainingStatus = "Complete";

  return {
    available: true,
    asOfDate,
    totalRecords,
    verifiedRecords,
    unverifiedRecords,
    completedCourseCount: requirements.filter((r) => r.status === "Completed").length,
    missingRequiredCourseCount: missingRequirements.length,
    expiringSoonCount: expiringSoon.length,
    expiredCount: expired.length,
    requiredRequirements: requirements,
    completedCourses: evidence,
    missingRequirements,
    expiringSoon,
    expired,
    trainingStatus,
    displayStatusTh: TRAINING_STATUS_DISPLAY_TH[trainingStatus],
    recommendationsTh: recommendationsFor(trainingStatus, missingRequirements, expiringSoon, expired),
    dataQualityFlags,
  };
}
