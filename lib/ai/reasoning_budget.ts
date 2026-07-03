/**
 * ReasoningBudget
 *
 * Reasoning-capable models (gpt-5.5, o1, o3, ...) spend completion tokens
 * on internal reasoning *before* producing any visible output text. If the
 * total `max_completion_tokens` budget is too small, the model can exhaust
 * it entirely on reasoning and return `finish_reason: "length"` with an
 * empty `message.content` — exactly the bug this module exists to prevent.
 *
 * This models reasoning and output token budgets as independently
 * configurable values that are combined into the single
 * `max_completion_tokens` figure the Chat Completions API actually accepts
 * (there is no separate reasoning-budget request parameter on this API as
 * of this writing — see docs/OPENAI_VISION.md). Keeping them distinct here
 * means a future API/model that *does* expose a separate reasoning-budget
 * parameter can be supported without changing any caller of this module.
 */

/** Default token budget reserved for the model's internal reasoning. */
export const DEFAULT_REASONING_TOKENS = 2048;
/** Default token budget reserved for the model's visible output. */
export const DEFAULT_OUTPUT_TOKENS = 2048;
/** Default combined budget (reasoning + output), replacing the old flat 1024 default that was too small for reasoning models. */
export const DEFAULT_TOTAL_COMPLETION_TOKENS = DEFAULT_REASONING_TOKENS + DEFAULT_OUTPUT_TOKENS;

export interface ReasoningBudgetConfig {
  /** Tokens reserved for internal reasoning. Not directly enforceable via this API today; tracked for future use and for sizing `totalTokens`. */
  reasoningTokens?: number;
  /** Tokens reserved for visible output text. */
  outputTokens?: number;
}

export interface ReasoningBudget {
  reasoningTokens: number;
  outputTokens: number;
  /** The value actually sent as `max_completion_tokens` — the sum of both budgets. */
  totalTokens: number;
}

/**
 * Builds a ReasoningBudget from independently-configurable reasoning/output
 * token allowances, defaulting to 2048 + 2048 = 4096 total (replacing the
 * old flat default of 1024, which left no room for reasoning-heavy models).
 */
export function buildReasoningBudget(config: ReasoningBudgetConfig = {}): ReasoningBudget {
  const reasoningTokens = config.reasoningTokens ?? DEFAULT_REASONING_TOKENS;
  const outputTokens = config.outputTokens ?? DEFAULT_OUTPUT_TOKENS;

  return {
    reasoningTokens,
    outputTokens,
    totalTokens: reasoningTokens + outputTokens,
  };
}

/**
 * Backwards-compatible helper: builds a ReasoningBudget from a single flat
 * `maxOutputTokens` number (the old VisionRequest shape), treating it as
 * the *total* completion budget with the default reasoning/output split.
 * If the provided value is at least the new default total, it is used
 * as-is (assumed already sized for reasoning); otherwise the new default
 * total (4096) is used so pre-existing small values don't reintroduce the
 * length-truncation bug this fix addresses.
 */
export function reasoningBudgetFromLegacyMaxTokens(maxOutputTokens: number): ReasoningBudget {
  const totalTokens = Math.max(maxOutputTokens, DEFAULT_TOTAL_COMPLETION_TOKENS);
  const ratio = DEFAULT_OUTPUT_TOKENS / DEFAULT_TOTAL_COMPLETION_TOKENS;

  return {
    reasoningTokens: Math.round(totalTokens * (1 - ratio)),
    outputTokens: Math.round(totalTokens * ratio),
    totalTokens,
  };
}
