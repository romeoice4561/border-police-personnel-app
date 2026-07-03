/**
 * CostEstimator
 *
 * Estimates USD cost for a Vision extraction run, given image count and
 * token usage (real, if the provider reports it; otherwise from
 * TokenEstimator). Pricing is injected configuration, not hardcoded, so it
 * can be updated as OpenAI pricing changes without editing this module.
 */

import type { TokenEstimate } from "@/lib/ai/token_estimator";

export interface VisionPricing {
  /** USD per 1,000 prompt tokens. */
  promptPricePer1k: number;
  /** USD per 1,000 completion/response tokens. */
  completionPricePer1k: number;
}

export interface CostEstimate {
  imageCount: number;
  estimatedTokens: TokenEstimate;
  estimatedCostUsd: number;
}

/** Contract for cost estimation. Allows swapping in a per-model pricing table later. */
export interface CostEstimator {
  estimate(imageCount: number, tokens: TokenEstimate): CostEstimate;
}

/**
 * Default placeholder pricing. Values are illustrative, not guaranteed
 * current OpenAI pricing — operators should override via
 * `DefaultCostEstimator`'s constructor with up-to-date figures.
 */
export const DEFAULT_VISION_PRICING: VisionPricing = {
  promptPricePer1k: 0.005,
  completionPricePer1k: 0.015,
};

export class DefaultCostEstimator implements CostEstimator {
  constructor(private readonly pricing: VisionPricing = DEFAULT_VISION_PRICING) {}

  estimate(imageCount: number, tokens: TokenEstimate): CostEstimate {
    const promptCost = (tokens.promptTokens / 1000) * this.pricing.promptPricePer1k;
    const completionCost = (tokens.responseTokens / 1000) * this.pricing.completionPricePer1k;

    return {
      imageCount,
      estimatedTokens: tokens,
      estimatedCostUsd: Math.round((promptCost + completionCost) * 1_000_000) / 1_000_000,
    };
  }
}
