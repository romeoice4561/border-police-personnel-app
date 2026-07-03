/**
 * TokenEstimator
 *
 * Approximates prompt and response token counts without a real tokenizer
 * dependency (no external libraries added in this phase). Used by
 * CostEstimator, and as a fallback when a provider response doesn't
 * include a `usage` block.
 *
 * Approximation basis: ~4 characters per token for English text (a widely
 * used rule of thumb for GPT-family tokenizers), plus a fixed per-image
 * token allowance representative of vision-model image encoding costs.
 */

const CHARS_PER_TOKEN = 4;
/** Flat per-image token allowance; real cost varies with resolution/detail level. */
const DEFAULT_IMAGE_TOKENS = 765;

export interface TokenEstimate {
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
}

/** Contract for token estimation. Allows swapping in a real tokenizer (e.g. tiktoken) later. */
export interface TokenEstimator {
  estimatePromptTokens(prompt: string, imageCount: number): number;
  estimateResponseTokens(responseText: string): number;
  estimate(prompt: string, imageCount: number, responseText: string): TokenEstimate;
}

/**
 * Character-count-based estimator.
 *
 * Future extension point: replace with a real tokenizer for exact counts,
 * behind the same `TokenEstimator` interface.
 */
export class HeuristicTokenEstimator implements TokenEstimator {
  estimatePromptTokens(prompt: string, imageCount: number): number {
    const textTokens = Math.ceil(prompt.length / CHARS_PER_TOKEN);
    return textTokens + imageCount * DEFAULT_IMAGE_TOKENS;
  }

  estimateResponseTokens(responseText: string): number {
    return Math.ceil(responseText.length / CHARS_PER_TOKEN);
  }

  estimate(prompt: string, imageCount: number, responseText: string): TokenEstimate {
    const promptTokens = this.estimatePromptTokens(prompt, imageCount);
    const responseTokens = this.estimateResponseTokens(responseText);
    return {
      promptTokens,
      responseTokens,
      totalTokens: promptTokens + responseTokens,
    };
  }
}
