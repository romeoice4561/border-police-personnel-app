/**
 * AI usage budget policy (Phase 48 — spec §8).
 *
 * Central, configurable controls for when paid AI fallback is allowed to
 * run at all. Every default here is deliberately conservative (spec's
 * explicit recommended defaults) — nothing in this module calls AI itself;
 * it only describes what's ALLOWED. The actual decision of whether to call
 * AI for a specific result lives in ai_gate.ts, which reads this policy.
 *
 * Pure data + pure functions — no I/O, no React, no provider calls.
 */

export interface AiUsagePolicy {
  /** Master switch: is AI fallback available at all, even with user confirmation? */
  aiFallbackEnabled: boolean;
  /** If true, AI may run automatically without a user click (still gated by every other rule below). Spec default: false. */
  automaticFallbackAllowed: boolean;
  /** If true, the user must explicitly confirm before any AI call, even when automaticFallbackAllowed is true for a future admin-approved policy. Spec default: true. */
  requireUserConfirmation: boolean;
  /** Hard cap on AI calls for a single document (one fingerprint+field-set). Spec default: 1. */
  maxAiCallsPerDocument: number;
  /** Automatic retries after an AI call fails. Spec default: 0 — failures are never silently retried. */
  maxAutomaticRetries: number;
  /** Daily cap across the whole app. null = no limit configured (still requires explicit enablement elsewhere to matter). */
  dailyCallLimit: number | null;
  /** Monthly cap across the whole app. */
  monthlyCallLimit: number | null;
  /** Per-user daily cap. */
  perUserDailyLimit: number | null;
  /** Document type codes AI fallback is allowed to run for. Empty array = none configured yet (safe default). */
  supportedDocumentTypes: readonly string[];
  /** Files above this size are never sent to AI automatically. */
  maxFileSizeBytes: number;
  /** PDFs above this page count are never sent to AI automatically (spec §16). */
  maxPageCount: number;
  /** Whether an exact-duplicate (cache-hit) file may be reprocessed by AI. Spec default: false — a cache hit always short-circuits before this policy is even consulted, but the flag exists so the gate can assert it explicitly. */
  duplicateReprocessingAllowed: boolean;
}

/**
 * Spec §8's recommended conservative defaults verbatim:
 *   automatic paid fallback: OFF
 *   user confirmation: ON
 *   maximum AI calls per document: 1
 *   automatic retries: 0
 *   duplicate reprocessing: OFF
 *   unsupported large PDF automatic AI: OFF (enforced via maxPageCount + the gate, not a separate flag)
 */
export const DEFAULT_AI_USAGE_POLICY: AiUsagePolicy = {
  aiFallbackEnabled: true,
  automaticFallbackAllowed: false,
  requireUserConfirmation: true,
  maxAiCallsPerDocument: 1,
  maxAutomaticRetries: 0,
  dailyCallLimit: null,
  monthlyCallLimit: null,
  perUserDailyLimit: null,
  supportedDocumentTypes: [
    "NATIONAL_ID",
    "DRIVER_LICENSE",
    "PASSPORT",
    "MEDICAL_DOCUMENT",
    "TRAINING_CERTIFICATE",
    "EDUCATION_CERTIFICATE",
    "AWARD",
    "GP7",
  ],
  maxFileSizeBytes: 10 * 1024 * 1024, // matches document_validation.ts's MAX_DOCUMENT_BYTES — never more permissive than the upload limit
  maxPageCount: 5, // spec §16's default: OCR up to 5 pages automatically
  duplicateReprocessingAllowed: false,
};

/** How many AI calls have already been made for a given cache key / document, tracked by the caller (usage_meter.ts) and passed in here for the budget check. */
export interface AiCallHistory {
  callsForThisDocument: number;
  callsToday: number;
  callsThisMonth: number;
  callsTodayForThisUser: number;
}

export type BudgetCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Pure check of whether a NEW AI call is permitted under the policy, given
 * the caller's already-recorded usage history. Does not know anything about
 * confidence/document content — that's ai_gate.ts's job. This function only
 * answers "does the budget allow it," independent of whether it's even
 * warranted.
 */
export function checkAiCallBudget(policy: AiUsagePolicy, history: AiCallHistory): BudgetCheckResult {
  if (!policy.aiFallbackEnabled) return { allowed: false, reason: "AI fallback is disabled by policy." };
  if (history.callsForThisDocument >= policy.maxAiCallsPerDocument) {
    return { allowed: false, reason: `Maximum AI calls per document (${policy.maxAiCallsPerDocument}) already reached.` };
  }
  if (policy.dailyCallLimit !== null && history.callsToday >= policy.dailyCallLimit) {
    return { allowed: false, reason: "Daily AI call limit reached." };
  }
  if (policy.monthlyCallLimit !== null && history.callsThisMonth >= policy.monthlyCallLimit) {
    return { allowed: false, reason: "Monthly AI call limit reached." };
  }
  if (policy.perUserDailyLimit !== null && history.callsTodayForThisUser >= policy.perUserDailyLimit) {
    return { allowed: false, reason: "Per-user daily AI call limit reached." };
  }
  return { allowed: true };
}
