# Vision Costs

Describes how the system estimates token usage and USD cost for Vision
extraction runs, so an operator can project cost before running an import
of tens of thousands of images (Phase 3's scale target).

## Token Estimation

`HeuristicTokenEstimator` (`token_estimator.ts`) approximates token counts
without a real tokenizer dependency:

- **Prompt tokens** — prompt text length / 4 characters-per-token, plus a
  flat **765 tokens per image** (a representative vision-model image
  encoding allowance; actual cost varies with image resolution/detail
  level).
- **Response tokens** — response text length / 4 characters-per-token.

This is a heuristic, not an exact count. When a real OpenAI response
includes a `usage` block (prompt_tokens/completion_tokens/total_tokens),
that real data should be preferred over the estimate for post-hoc
accounting; the estimator exists primarily for **pre-run projection**
(estimating cost for a batch before calling the API) and as a fallback for
providers/responses that omit usage data.

```ts
const estimator = new HeuristicTokenEstimator();
const tokens = estimator.estimate(prompt, imageCount, expectedResponseText);
```

## Cost Estimation

`DefaultCostEstimator` (`cost_estimator.ts`) converts a `TokenEstimate`
into an estimated USD cost using an injected `VisionPricing` table:

```ts
interface VisionPricing {
  promptPricePer1k: number;      // USD per 1,000 prompt tokens
  completionPricePer1k: number;  // USD per 1,000 completion tokens
}
```

`DEFAULT_VISION_PRICING` ships illustrative placeholder values — **not
guaranteed to reflect current OpenAI pricing**. Operators must supply
current pricing when accuracy matters:

```ts
const estimator = new DefaultCostEstimator({
  promptPricePer1k: 0.005,      // update to current published pricing
  completionPricePer1k: 0.015,  // update to current published pricing
});

const cost = estimator.estimate(imageCount, tokens);
// { imageCount, estimatedTokens, estimatedCostUsd }
```

## Projecting Cost for a Large Batch

To project cost before running an import of N images:

```ts
const estimator = new HeuristicTokenEstimator();
const costEstimator = new DefaultCostEstimator(currentPricing);

const perImageTokens = estimator.estimate(prompt, 1, "");
const totalPromptTokens = perImageTokens.promptTokens * imageCount;

const projected = costEstimator.estimate(imageCount, {
  promptTokens: totalPromptTokens,
  responseTokens: averageExpectedResponseTokens * imageCount,
  totalTokens: totalPromptTokens + averageExpectedResponseTokens * imageCount,
});

console.log(`Estimated cost for ${imageCount} images: $${projected.estimatedCostUsd}`);
```

## Recommended Practice

- Re-run a small sample batch (e.g. 10-20 images) with real OpenAI usage
  data before projecting cost for the full tens-of-thousands-image import,
  since the flat per-image token allowance is a rough average.
- Keep `VisionPricing` values centralized and easy to update — do not
  hardcode pricing inline elsewhere in the codebase.
- Track actual `VisionResponseUsage` from real responses (Phase 5's
  `OpenAIClient` already surfaces this) to compare against pre-run
  projections and refine the per-image token allowance over time.

## Future Extension Points

- Replace the flat per-image token allowance with a resolution-aware
  estimate once real image sizes from the Google Drive Scanner (Phase 4)
  are available.
- Track a running total cost across an entire import job/batch (Phase 3's
  `ImportMetricsSnapshot` could be extended with a cost field).
- Support per-model pricing tables if multiple Vision models are used
  across regions or phases.
