/**
 * Confidence policy (Phase 48 — spec §4).
 *
 * Configurable thresholds — NOT hardcoded in any component. Every place
 * that needs to know "is this confidence high/medium/low" calls
 * `classifyConfidence()` with an (optionally overridden) ConfidencePolicy,
 * never compares a raw number against a literal threshold inline.
 *
 * Pure — no I/O, no React.
 */

export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

export interface ConfidencePolicy {
  /** Score (0-1) at or above which confidence is "high". */
  highThreshold: number;
  /** Score (0-1) at or above which confidence is "medium" (below highThreshold). */
  mediumThreshold: number;
}

/** Spec §4's suggested initial policy: high >= 0.90, medium 0.70-0.89, low < 0.70. */
export const DEFAULT_CONFIDENCE_POLICY: ConfidencePolicy = {
  highThreshold: 0.9,
  mediumThreshold: 0.7,
};

/**
 * Classifies a 0-1 confidence score into a level using the given policy.
 * `score === null` (no score could be computed at all, e.g. OCR produced no
 * text) always classifies as "unknown" — never silently treated as "low",
 * since "low but measured" and "couldn't measure at all" call for different
 * UI messaging (spec §4's "Unknown: require manual review or user-approved
 * AI fallback").
 */
export function classifyConfidence(score: number | null, policy: ConfidencePolicy = DEFAULT_CONFIDENCE_POLICY): ConfidenceLevel {
  if (score === null || Number.isNaN(score)) return "unknown";
  if (score >= policy.highThreshold) return "high";
  if (score >= policy.mediumThreshold) return "medium";
  return "low";
}
