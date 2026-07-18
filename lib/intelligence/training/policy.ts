/**
 * Training policy source (Phase 45, Task 4).
 *
 * Audit finding (docs/TRAINING_INTELLIGENCE.md): no real, curator-approved
 * "this course is required for this position level/rank" policy exists
 * anywhere in the codebase today. `PROMOTION_POLICIES`
 * (lib/promotion/eligibility_policy.ts) already has a `requiredTrainingCodes`
 * field wired into its rule engine, but every one of its 6 entries currently
 * OMITS it — meaning zero courses are required for any promotion today. This
 * module does NOT invent policy data to fill that gap. It defines the
 * `TrainingPolicy` shape and an explicit extension point
 * (`TRAINING_POLICIES`, currently empty) so a future curator can configure
 * real requirements later without any engine change.
 *
 * `trainingPoliciesForTargetLevel()` returns an empty array today for every
 * level — callers (the evaluator in requirement_evaluation.ts) must treat an
 * empty result as `NoPolicy`, never as `MissingRequired` with zero
 * requirements masquerading as "complete."
 *
 * Pure — no I/O, no React.
 */
import type { PositionLevel } from "@/lib/commander_query/position_level";

export interface TrainingPolicy {
  policyId: string;
  targetPositionLevel?: string;
  targetRank?: string;
  /** Normalized course keys (see course_normalization.ts) — never raw free-text course names. */
  requiredCourseKeys: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
}

/**
 * The extension point. Empty by design — see the module doc comment. Do not
 * add an entry here without an explicit, sourced curator decision; this
 * phase's task list explicitly forbids inventing mandatory-course policies.
 */
export const TRAINING_POLICIES: readonly TrainingPolicy[] = [];

/** Every configured policy targeting `positionLevel` (empty when none — the caller must render `NoPolicy`, not a fabricated pass/fail). */
export function trainingPoliciesForTargetLevel(positionLevel: PositionLevel | string): readonly TrainingPolicy[] {
  return TRAINING_POLICIES.filter((policy) => policy.targetPositionLevel === positionLevel);
}

/** True when ANY policy exists for `positionLevel` — the single place callers check before evaluating requirements vs. reporting NoPolicy. */
export function hasTrainingPolicyForTargetLevel(positionLevel: PositionLevel | string): boolean {
  return trainingPoliciesForTargetLevel(positionLevel).length > 0;
}
