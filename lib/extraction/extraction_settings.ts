/**
 * Centralized extraction configuration (Phase 48B — spec §10).
 *
 * ONE place every numeric/boolean tuning knob for the extraction subsystem
 * lives — so no component ever hardcodes e.g. "5 pages" or "10MB" inline.
 * This module does not introduce new limits; it re-exports/aggregates the
 * ones that already exist across budget_policy.ts, confidence.ts, and
 * governance_policy.ts into one settings object, plus the handful of
 * genuinely new Phase 48B knobs (queue/near-duplicate enablement, quality
 * thresholds) that had no prior home.
 *
 * Pure data — no I/O, no React.
 */

import { DEFAULT_AI_USAGE_POLICY, type AiUsagePolicy } from "@/lib/extraction/budget_policy";
import { DEFAULT_CONFIDENCE_POLICY, type ConfidencePolicy } from "@/lib/extraction/confidence";
import { DEFAULT_GOVERNANCE_POLICY, type GovernancePolicy } from "@/lib/extraction/governance_policy";

export interface ExtractionSettings {
  /** Re-exposed for convenience — the true values live in budget_policy.ts's AiUsagePolicy. */
  maxPageCount: number;
  maxFileSizeBytes: number;
  dailyBudget: number | null;
  monthlyBudget: number | null;
  aiEnabled: boolean;
  confirmationRequired: boolean;
  /** New this phase — queue processing is architected (processing_queue.ts) but not required to be "on" for the pipeline to keep working synchronously. */
  queueEnabled: boolean;
  /** New this phase — near_duplicate_detection.ts ships only ExactOnlyNearDuplicateDetector; this flag exists so a future real provider can be toggled without a code change once one exists. */
  nearDuplicateEnabled: boolean;
  confidencePolicy: ConfidencePolicy;
  governancePolicy: GovernancePolicy;
  usagePolicy: AiUsagePolicy;
}

/**
 * Builds the aggregate settings object from the individual policy modules'
 * own defaults — never redefines a threshold that already has a canonical
 * home elsewhere.
 */
export function buildDefaultExtractionSettings(): ExtractionSettings {
  return {
    maxPageCount: DEFAULT_AI_USAGE_POLICY.maxPageCount,
    maxFileSizeBytes: DEFAULT_AI_USAGE_POLICY.maxFileSizeBytes,
    dailyBudget: DEFAULT_AI_USAGE_POLICY.dailyCallLimit,
    monthlyBudget: DEFAULT_AI_USAGE_POLICY.monthlyCallLimit,
    aiEnabled: DEFAULT_AI_USAGE_POLICY.aiFallbackEnabled,
    confirmationRequired: DEFAULT_AI_USAGE_POLICY.requireUserConfirmation,
    queueEnabled: false,
    nearDuplicateEnabled: false,
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
    governancePolicy: DEFAULT_GOVERNANCE_POLICY,
    usagePolicy: DEFAULT_AI_USAGE_POLICY,
  };
}

export const DEFAULT_EXTRACTION_SETTINGS: ExtractionSettings = buildDefaultExtractionSettings();
