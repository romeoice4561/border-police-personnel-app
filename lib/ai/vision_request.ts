/**
 * VisionRequest
 *
 * Provider-agnostic shape of a single Vision request: an image reference, a
 * prompt, and generation parameters. This is what OpenAIVisionProvider
 * builds internally before calling OpenAIClient — it is not itself the
 * wire format sent to OpenAI (see openai_client.ts for that translation).
 */

import {
  buildReasoningBudget,
  reasoningBudgetFromLegacyMaxTokens,
  type ReasoningBudget,
  type ReasoningBudgetConfig,
} from "@/lib/ai/reasoning_budget";

export interface VisionRequestOptions {
  temperature?: number;
  /**
   * @deprecated Prefer `reasoningBudget` so reasoning and output token
   * allowances can be configured independently. Still supported for
   * backwards compatibility: a provided value is treated as the total
   * completion budget (see reasoningBudgetFromLegacyMaxTokens).
   */
  maxOutputTokens?: number;
  /** Configures reasoning vs. output token allowances independently. Defaults to 2048 reasoning + 2048 output = 4096 total. */
  reasoningBudget?: ReasoningBudgetConfig;
}

export interface VisionRequest {
  /** Path, URL, or data URI identifying the source image. */
  imagePath: string;
  prompt: string;
  temperature: number;
  /** @deprecated Use `reasoningBudget.totalTokens`. Kept for backwards compatibility with callers reading this field. */
  maxOutputTokens: number;
  reasoningBudget: ReasoningBudget;
}

const DEFAULT_TEMPERATURE = 0.1;

/**
 * Builds a fully-populated VisionRequest, applying defaults for any
 * omitted generation parameters. Low default temperature favors
 * deterministic, consistent field extraction over creative variation.
 *
 * Token budget resolution, in priority order:
 * 1. `options.reasoningBudget`, if provided — reasoning/output configured
 *    independently.
 * 2. `options.maxOutputTokens`, if provided — treated as the legacy total
 *    completion budget (backwards compatible with pre-existing callers).
 * 3. The default budget: 2048 reasoning + 2048 output = 4096 total,
 *    replacing the old flat 1024 default that left reasoning-heavy models
 *    no room to produce visible output.
 */
export function buildVisionRequest(
  imagePath: string,
  prompt: string,
  options: VisionRequestOptions = {}
): VisionRequest {
  const reasoningBudget = options.reasoningBudget
    ? buildReasoningBudget(options.reasoningBudget)
    : options.maxOutputTokens !== undefined
      ? reasoningBudgetFromLegacyMaxTokens(options.maxOutputTokens)
      : buildReasoningBudget();

  return {
    imagePath,
    prompt,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: reasoningBudget.totalTokens,
    reasoningBudget,
  };
}
