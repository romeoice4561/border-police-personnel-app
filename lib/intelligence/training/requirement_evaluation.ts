/**
 * Required-training evaluation (Phase 45, Task 5).
 *
 * Pure comparison of an officer's normalized training evidence against a
 * configured TrainingPolicy's `requiredCourseKeys`. Never marks a course
 * complete from a partial/fuzzy name match — only an exact normalized-key
 * or documented-alias match (see course_normalization.ts) counts.
 *
 * Pure — no I/O, no React.
 */
import { computeExpirySummary } from "@/lib/intelligence/training/expiry";
import type { TrainingRecordEvidence, TrainingRequirementResult } from "@/lib/intelligence/training/types";

/** A minimal courseKey -> displayNameTh lookup a caller may supply (e.g. a curated course catalog). Falls back to the raw key when no display name is known — never a guessed Thai translation. */
export type CourseDisplayNameResolver = (requirementKey: string) => string | null;

/**
 * Evaluates ONE required course key against the officer's evidence.
 * Distinguishes completed+verified, completed+unverified, missing, expired,
 * expiring soon, and unknown (evidence exists but verification status is
 * untracked for this record type — see TrainingRecordEvidence.verified's
 * doc comment). `asOf` is deterministic — never `new Date()` inside this
 * function.
 */
export function evaluateRequirement(
  requirementKey: string,
  evidence: readonly TrainingRecordEvidence[],
  asOf: Date,
  resolveDisplayName?: CourseDisplayNameResolver
): TrainingRequirementResult {
  const displayNameTh = resolveDisplayName?.(requirementKey) ?? requirementKey;
  const matches = evidence.filter((record) => record.normalizedCourseKey === requirementKey);

  if (matches.length === 0) {
    return {
      requirementKey,
      displayNameTh,
      status: "Missing",
      matchedRecordIds: [],
      completionDate: null,
      expiryDate: null,
      reasonTh: "ยังไม่พบข้อมูลการอบรมหลักสูตรนี้",
    };
  }

  // Prefer the most recently completed match when multiple records exist for the same course.
  const sorted = [...matches].sort((a, b) => (b.completionDate ?? "").localeCompare(a.completionDate ?? ""));
  const best = sorted[0];
  const matchedRecordIds = matches.map((record) => record.recordId);

  if (best.expiryDate) {
    const expirySummary = computeExpirySummary(best.expiryDate, asOf);
    if (expirySummary.available && expirySummary.band === "expired") {
      return {
        requirementKey,
        displayNameTh,
        status: "Expired",
        matchedRecordIds,
        completionDate: best.completionDate,
        expiryDate: best.expiryDate,
        reasonTh: "หลักสูตรนี้หมดอายุแล้ว ต้องอบรมทบทวน",
      };
    }
    if (expirySummary.available && (expirySummary.band === "expiring_soon" || expirySummary.band === "urgent" || expirySummary.band === "expires_today")) {
      return {
        requirementKey,
        displayNameTh,
        status: "ExpiringSoon",
        matchedRecordIds,
        completionDate: best.completionDate,
        expiryDate: best.expiryDate,
        reasonTh: "หลักสูตรนี้ใกล้หมดอายุ ควรอบรมทบทวน",
      };
    }
  }

  if (best.verified === false) {
    return {
      requirementKey,
      displayNameTh,
      status: "Unverified",
      matchedRecordIds,
      completionDate: best.completionDate,
      expiryDate: best.expiryDate,
      reasonTh: "พบข้อมูลการอบรมแล้ว แต่ยังไม่ผ่านการตรวจสอบ",
    };
  }

  if (best.verified === null) {
    // Verification is not tracked for this record type (the current Training
    // model reality) — the evidence exists, but its trustworthiness cannot
    // be confirmed either way. Reported as Unverified (not silently Completed)
    // so a commander sees the caveat rather than a false confidence signal.
    return {
      requirementKey,
      displayNameTh,
      status: "Unverified",
      matchedRecordIds,
      completionDate: best.completionDate,
      expiryDate: best.expiryDate,
      reasonTh: "พบข้อมูลการอบรมแล้ว แต่ระบบยังไม่รองรับการตรวจสอบสถานะของหลักสูตรนี้",
    };
  }

  return {
    requirementKey,
    displayNameTh,
    status: "Completed",
    matchedRecordIds,
    completionDate: best.completionDate,
    expiryDate: best.expiryDate,
    reasonTh: null,
  };
}

/** Evaluates every required course key for a policy against the officer's evidence. */
export function evaluateRequirements(
  requiredCourseKeys: readonly string[],
  evidence: readonly TrainingRecordEvidence[],
  asOf: Date,
  resolveDisplayName?: CourseDisplayNameResolver
): TrainingRequirementResult[] {
  return requiredCourseKeys.map((key) => evaluateRequirement(key, evidence, asOf, resolveDisplayName));
}
