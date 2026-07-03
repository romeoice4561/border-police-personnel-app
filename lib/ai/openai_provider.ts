/**
 * OpenAIVisionProvider
 *
 * Production Vision provider backed by OpenAI, satisfying the existing
 * `VisionProvider` interface from vision_extractor.ts (Phase 2) so it is a
 * drop-in replacement for `MockVisionProvider` with zero changes required
 * to `extractPersonnelFromImage` or anything downstream (Phase 3's
 * ImportPipeline, etc.).
 *
 * No API key is hardcoded: `OPENAI_API_KEY` is read from the environment
 * (or injected directly for tests) by `createOpenAIVisionProviderFromEnv`.
 */

import { buildVisionRequest, type VisionRequestOptions } from "@/lib/ai/vision_request";
import type { VisionProvider } from "@/lib/ai/vision_extractor";
import { DEFAULT_TIMEOUT_MS, HttpOpenAIClient, type OpenAIClient } from "@/lib/ai/openai_client";
import { StrictJsonResponseParser, type ResponseParser } from "@/lib/ai/response_parser";
import { ExponentialBackoffRetryPolicy, withRetry, type RetryPolicy } from "@/lib/ai/retry_policy";
import { InProcessRateLimiter, type RateLimiter } from "@/lib/ai/rate_limiter";
import { VisionValidationError } from "@/lib/ai/vision_errors";

export const DEFAULT_OPENAI_MODEL = "gpt-5.5";

export interface OpenAIVisionProviderDependencies {
  client: OpenAIClient;
  parser?: ResponseParser;
  retryPolicy?: RetryPolicy;
  rateLimiter?: RateLimiter;
  requestOptions?: VisionRequestOptions;
}

/**
 * Vision provider backed by a real OpenAI vision-capable model.
 *
 * Every collaborator (client, parser, retry policy, rate limiter) is
 * injected, so tests can substitute fakes and a future phase can swap the
 * transport (e.g. a real SDK client) without touching this class.
 */
export class OpenAIVisionProvider implements VisionProvider {
  private readonly client: OpenAIClient;
  private readonly parser: ResponseParser;
  private readonly retryPolicy: RetryPolicy;
  private readonly rateLimiter: RateLimiter;
  private readonly requestOptions: VisionRequestOptions;

  constructor(dependencies: OpenAIVisionProviderDependencies) {
    this.client = dependencies.client;
    this.parser = dependencies.parser ?? new StrictJsonResponseParser();
    this.retryPolicy = dependencies.retryPolicy ?? new ExponentialBackoffRetryPolicy();
    this.rateLimiter = dependencies.rateLimiter ?? new InProcessRateLimiter();
    this.requestOptions = dependencies.requestOptions ?? {};
  }

  /**
   * Satisfies `VisionProvider.extract(imagePath, prompt): Promise<string>`.
   * Returns a clean JSON string (see ResponseParser.extractJson), matching
   * MockVisionProvider's contract — parsing/validation of the *personnel*
   * schema still happens in vision_extractor.ts, unchanged from Phase 2.
   * This method extracts and validates the JSON *shape* only, tolerating
   * markdown fences and leading/trailing prose in the raw model output, so
   * that a real model's response only fails here when no valid JSON object
   * is present at all.
   */
  async extract(imagePath: string, prompt: string): Promise<string> {
    const request = buildVisionRequest(imagePath, prompt, this.requestOptions);

    await this.rateLimiter.acquire();
    try {
      const response = await withRetry(
        () => this.client.createVisionCompletion(request),
        this.retryPolicy
      );

      // Logged unconditionally so the exact model output is always visible
      // for debugging, independent of whether extraction succeeds.
      console.log("[OpenAIVisionProvider] raw assistant message:\n", response.content);

      return this.extractJsonOrThrow(response.content);
    } finally {
      this.rateLimiter.release();
    }
  }

  private extractJsonOrThrow(content: string): string {
    try {
      return this.parser.extractJson(content);
    } catch (error) {
      console.error("[OpenAIVisionProvider] failed to extract JSON from raw response:\n", content);

      if (error instanceof Error) {
        throw new VisionValidationError(`Vision response failed shape validation: ${error.message}`, [
          error.message,
        ]);
      }
      throw error;
    }
  }
}

export interface CreateOpenAIVisionProviderOptions {
  env?: NodeJS.ProcessEnv;
  requestOptions?: VisionRequestOptions;
  rateLimiter?: RateLimiter;
  retryPolicy?: RetryPolicy;
}

/**
 * Parses `OPENAI_TIMEOUT_MS`, falling back to `DEFAULT_TIMEOUT_MS` (60000)
 * if unset or not a valid positive number. The resolved value is always
 * logged by the caller (`createOpenAIVisionProviderFromEnv`) — the timeout
 * is never silently changed without a visible trace of what was configured
 * and where it came from.
 */
function resolveTimeoutMs(env: NodeJS.ProcessEnv): { timeoutMs: number; source: "env" | "default" } {
  const raw = env.OPENAI_TIMEOUT_MS;
  if (raw === undefined) {
    return { timeoutMs: DEFAULT_TIMEOUT_MS, source: "default" };
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[createOpenAIVisionProviderFromEnv] OPENAI_TIMEOUT_MS="${raw}" is not a valid positive number; ` +
        `falling back to default ${DEFAULT_TIMEOUT_MS}ms`
    );
    return { timeoutMs: DEFAULT_TIMEOUT_MS, source: "default" };
  }

  return { timeoutMs: parsed, source: "env" };
}

/**
 * Builds an OpenAIVisionProvider from environment variables:
 * - `OPENAI_API_KEY` (required)
 * - `OPENAI_MODEL` (optional, defaults to `gpt-5.5`)
 * - `OPENAI_TIMEOUT_MS` (optional, defaults to 60000)
 *
 * Throws synchronously if `OPENAI_API_KEY` is missing, so misconfiguration
 * is caught at startup rather than on first request.
 */
export function createOpenAIVisionProviderFromEnv(
  options: CreateOpenAIVisionProviderOptions = {}
): OpenAIVisionProvider {
  const env = options.env ?? process.env;
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required to create an OpenAIVisionProvider");
  }

  const model = env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const { timeoutMs, source } = resolveTimeoutMs(env);

  // Always logged, never a silent change: the effective timeout and where
  // it came from (explicit env var vs. default) is visible on every
  // provider construction.
  console.log(`[createOpenAIVisionProviderFromEnv] configured timeout: ${timeoutMs}ms (source: ${source})`);

  const client = new HttpOpenAIClient({ apiKey, model, timeoutMs });

  return new OpenAIVisionProvider({
    client,
    requestOptions: options.requestOptions,
    rateLimiter: options.rateLimiter,
    retryPolicy: options.retryPolicy,
  });
}
