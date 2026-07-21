/**
 * AI fallback decision gate (Phase 48 — spec §3).
 *
 * `shouldUseAiFallback()` is the SINGLE centralized function that decides
 * whether AI should be offered/used for an extraction result. No React
 * component may decide independently — every UI surface that shows an
 * "ใช้ AI ช่วยตรวจเพิ่มเติม" button or an automatic-fallback path must call
 * this function and act only on its verdict.
 *
 * Pure — no I/O, no provider calls, no React. This module only decides;
 * it never calls AI itself.
 */

import { classifyConfidence, type ConfidenceLevel, type ConfidencePolicy, DEFAULT_CONFIDENCE_POLICY } from "@/lib/extraction/confidence";
import { checkAiCallBudget, type AiCallHistory, type AiUsagePolicy, DEFAULT_AI_USAGE_POLICY } from "@/lib/extraction/budget_policy";
import { evaluateGovernanceMode, type GovernancePolicy, DEFAULT_GOVERNANCE_POLICY } from "@/lib/extraction/governance_policy";

export type AiFallbackReason =
  | "LOW_OCR_CONFIDENCE"
  | "UNKNOWN_DOCUMENT_TYPE"
  | "REQUIRED_FIELDS_MISSING"
  | "VALIDATION_FAILED"
  | "COMPLEX_LAYOUT"
  | "USER_REQUESTED"
  | "NOT_REQUIRED";

export interface AiGateInput {
  /** OCR confidence, 0-1 (already normalized from Tesseract's 0-100 by the caller). null when OCR produced nothing measurable. */
  ocrConfidence: number | null;
  /** Was the document type deterministically identified? */
  documentTypeKnown: boolean;
  /** Field codes the detected document type requires that extraction actually found. */
  requiredFieldsPresent: readonly string[];
  /** Field codes the detected document type requires overall. */
  requiredFieldsExpected: readonly string[];
  /** True if deterministic validation (checksum, date range, pattern) failed for any extracted field. */
  hasValidationFailures: boolean;
  /** True if the OCR/layout signals suggest a table-heavy or unusually complex document (e.g. GP7's multi-column history). */
  complexLayoutDetected: boolean;
  /** True only when the user explicitly clicked "ใช้ AI ช่วยตรวจเพิ่มเติม" (or an equivalent explicit re-analysis action) for THIS result. */
  userRequestedAi: boolean;
  /** This exact file (by fingerprint) was already found in the cache with a successful result. */
  isCacheHit: boolean;
  /** This exact file is a byte-identical duplicate of another already-processed document. */
  isExactDuplicate: boolean;
}

export interface AiGateDecision {
  shouldUseAi: boolean;
  reason: AiFallbackReason;
  confidenceLevel: ConfidenceLevel;
  /** Whether the policy allows this to run WITHOUT explicit user confirmation (spec §4's "high: no AI" / "low: recommend, don't call until confirmed"). Always false unless an admin policy explicitly enables automatic fallback. */
  automaticCallAllowed: boolean;
  /** Populated when shouldUseAi is true but the budget/policy blocks it anyway (e.g. max calls per document reached). */
  blockedByBudget?: string;
  /** Populated when the governance mode itself blocked or altered this decision (DISABLED, READ_ONLY, DRY_RUN). */
  blockedByGovernance?: string;
  /** True when governance mode is DRY_RUN — a recommendation may be shown/recorded, but the caller must never actually invoke the provider. */
  isDryRun: boolean;
}

/**
 * The one place every reason AI might be warranted is evaluated, in a fixed
 * priority order (spec §3's reason list). Cache hits and exact duplicates
 * are checked FIRST and unconditionally short-circuit to "NOT_REQUIRED" —
 * per spec §3's default policy, "never call AI for a cached file" and
 * "never call AI for an exact duplicate" are absolute, not just
 * confidence-dependent.
 */
export function shouldUseAiFallback(
  input: AiGateInput,
  options: {
    confidencePolicy?: ConfidencePolicy;
    usagePolicy?: AiUsagePolicy;
    callHistory?: AiCallHistory;
    governancePolicy?: GovernancePolicy;
  } = {}
): AiGateDecision {
  const confidencePolicy = options.confidencePolicy ?? DEFAULT_CONFIDENCE_POLICY;
  const usagePolicy = options.usagePolicy ?? DEFAULT_AI_USAGE_POLICY;
  const confidenceLevel = classifyConfidence(input.ocrConfidence, confidencePolicy);

  const decision = computeBaseDecision(input, confidenceLevel, usagePolicy, options.callHistory);
  return applyGovernance(decision, options.governancePolicy ?? DEFAULT_GOVERNANCE_POLICY);
}

/**
 * The original spec §3 reason-priority evaluation, unchanged from Phase
 * 48A, now factored out so shouldUseAiFallback() can layer governance
 * (Phase 48B) on top as a separate, final step — mirroring applyBudget()'s
 * existing "wrap, don't rewrite" pattern.
 */
function computeBaseDecision(
  input: AiGateInput,
  confidenceLevel: ConfidenceLevel,
  usagePolicy: AiUsagePolicy,
  callHistory?: AiCallHistory
): AiGateDecision {
  // Cache hits and exact duplicates: never call AI, full stop.
  if (input.isCacheHit) {
    return { shouldUseAi: false, reason: "NOT_REQUIRED", confidenceLevel, automaticCallAllowed: false, isDryRun: false };
  }
  if (input.isExactDuplicate && !usagePolicy.duplicateReprocessingAllowed) {
    return { shouldUseAi: false, reason: "NOT_REQUIRED", confidenceLevel, automaticCallAllowed: false, isDryRun: false };
  }

  // Explicit user request always wins (still subject to the budget check below).
  if (input.userRequestedAi) {
    return applyBudget(
      { shouldUseAi: true, reason: "USER_REQUESTED", confidenceLevel, automaticCallAllowed: false, isDryRun: false },
      usagePolicy,
      callHistory
    );
  }

  const missingRequiredFields = input.requiredFieldsExpected.filter((f) => !input.requiredFieldsPresent.includes(f));

  if (!input.documentTypeKnown) {
    return applyBudget(
      { shouldUseAi: true, reason: "UNKNOWN_DOCUMENT_TYPE", confidenceLevel, automaticCallAllowed: false, isDryRun: false },
      usagePolicy,
      callHistory
    );
  }
  if (missingRequiredFields.length > 0) {
    return applyBudget(
      { shouldUseAi: true, reason: "REQUIRED_FIELDS_MISSING", confidenceLevel, automaticCallAllowed: false, isDryRun: false },
      usagePolicy,
      callHistory
    );
  }
  if (input.hasValidationFailures) {
    return applyBudget(
      { shouldUseAi: true, reason: "VALIDATION_FAILED", confidenceLevel, automaticCallAllowed: false, isDryRun: false },
      usagePolicy,
      callHistory
    );
  }
  if (input.complexLayoutDetected) {
    return applyBudget(
      { shouldUseAi: true, reason: "COMPLEX_LAYOUT", confidenceLevel, automaticCallAllowed: false, isDryRun: false },
      usagePolicy,
      callHistory
    );
  }

  // Confidence-only signal, per spec §4's behavior table.
  if (confidenceLevel === "low" || confidenceLevel === "unknown") {
    // "recommend AI fallback... do not call until user confirms, unless an
    // admin policy explicitly enables automatic fallback" — automaticCallAllowed
    // reflects that admin flag; shouldUseAi is true only to mean "worth
    // recommending," never "call it now."
    return applyBudget(
      {
        shouldUseAi: true,
        reason: "LOW_OCR_CONFIDENCE",
        confidenceLevel,
        automaticCallAllowed: usagePolicy.automaticFallbackAllowed && !usagePolicy.requireUserConfirmation,
        isDryRun: false,
      },
      usagePolicy,
      callHistory
    );
  }

  // Medium confidence: never automatic; the UI may offer the optional button,
  // but the gate itself does not recommend proactively calling AI.
  if (confidenceLevel === "medium") {
    return { shouldUseAi: false, reason: "NOT_REQUIRED", confidenceLevel, automaticCallAllowed: false, isDryRun: false };
  }

  // High confidence and everything else checked out — no AI, ever, automatically.
  return { shouldUseAi: false, reason: "NOT_REQUIRED", confidenceLevel, automaticCallAllowed: false, isDryRun: false };
}

function applyBudget(decision: AiGateDecision, usagePolicy: AiUsagePolicy, callHistory?: AiCallHistory): AiGateDecision {
  if (!callHistory) return decision;
  const budgetCheck = checkAiCallBudget(usagePolicy, callHistory);
  if (!budgetCheck.allowed) {
    return { ...decision, shouldUseAi: false, automaticCallAllowed: false, blockedByBudget: budgetCheck.reason };
  }
  return decision;
}

/**
 * Final layer: interprets the governance mode against the already-computed
 * decision. Never RAISES what the reason-priority logic decided (e.g.
 * DISABLED/READ_ONLY can only turn a "yes" into a "no"; AUTOMATIC can only
 * relax the confirmation requirement, never invent a new reason to call AI
 * that computeBaseDecision() didn't already find).
 */
function applyGovernance(decision: AiGateDecision, governancePolicy: GovernancePolicy): AiGateDecision {
  const evaluation = evaluateGovernanceMode(governancePolicy.mode);

  if (!evaluation.aiPermitted) {
    if (!decision.shouldUseAi) return decision;
    return { ...decision, shouldUseAi: false, automaticCallAllowed: false, blockedByGovernance: evaluation.reason };
  }

  if (!decision.shouldUseAi) return decision;

  return {
    ...decision,
    automaticCallAllowed: evaluation.forcesAutomatic ? true : decision.automaticCallAllowed,
    isDryRun: evaluation.suppressActualCall,
  };
}
