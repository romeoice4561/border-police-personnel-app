/**
 * Tier 3 AiExtractionProvider — OpenAI-backed (Phase 48 — spec §2/§18).
 *
 * Reuses lib/ai/retry_policy.ts, lib/ai/rate_limiter.ts,
 * lib/ai/response_parser.ts (all genuinely provider-agnostic, non-logging
 * plumbing) and lib/ai/reasoning_budget.ts's token-budget math — but talks
 * over SafeOpenAIDocumentClient (redacted logging), not
 * lib/ai/openai_client.ts's HttpOpenAIClient (see that file's header
 * comment for why). Uses a NEW prompt (generic_document_prompt.ts) — never
 * the personnel-import prompt from lib/ai/prompt_builder.ts, which expects
 * a different schema entirely.
 *
 * No API key hardcoded: read from OPENAI_API_KEY by
 * createOpenAiDocumentProviderFromEnv, same convention as
 * lib/ai/openai_provider.ts's createOpenAIVisionProviderFromEnv. Never
 * exposed to the client — this module only runs server-side (imported only
 * from API route handlers / server actions, never a "use client" file).
 */

import { ExponentialBackoffRetryPolicy, withRetry, type RetryPolicy } from "@/lib/ai/retry_policy";
import { InProcessRateLimiter, type RateLimiter } from "@/lib/ai/rate_limiter";
import { StrictJsonResponseParser, type ResponseParser } from "@/lib/ai/response_parser";
import { buildReasoningBudget } from "@/lib/ai/reasoning_budget";
import { VisionValidationError } from "@/lib/ai/vision_errors";
import { SafeOpenAIDocumentClient, type OpenAIDocumentClient } from "@/lib/extraction/providers/safe_openai_document_client";
import { buildGenericDocumentExtractionPrompt, PROMPT_SCHEMA_VERSION } from "@/lib/extraction/providers/generic_document_prompt";
import type { AiExtractionProvider, AiExtractionResponse } from "@/lib/extraction/providers/extraction_provider_types";

export const DEFAULT_DOCUMENT_EXTRACTION_MODEL = "gpt-5.5";

interface ParsedExtractionResponse {
  documentType?: string;
  confidence?: number;
  fields?: Record<string, string | null>;
}

function isParsedExtractionResponse(value: unknown): value is ParsedExtractionResponse {
  return typeof value === "object" && value !== null;
}

export interface OpenAiDocumentProviderDependencies {
  client: OpenAIDocumentClient;
  parser?: ResponseParser;
  retryPolicy?: RetryPolicy;
  rateLimiter?: RateLimiter;
}

export class OpenAiDocumentExtractionProvider implements AiExtractionProvider {
  readonly providerName = "openai";
  readonly modelName: string;
  readonly promptSchemaVersion = PROMPT_SCHEMA_VERSION;

  private readonly client: OpenAIDocumentClient;
  private readonly parser: ResponseParser;
  private readonly retryPolicy: RetryPolicy;
  private readonly rateLimiter: RateLimiter;

  constructor(dependencies: OpenAiDocumentProviderDependencies) {
    this.client = dependencies.client;
    this.modelName = dependencies.client.model;
    this.parser = dependencies.parser ?? new StrictJsonResponseParser();
    this.retryPolicy = dependencies.retryPolicy ?? new ExponentialBackoffRetryPolicy();
    this.rateLimiter = dependencies.rateLimiter ?? new InProcessRateLimiter();
  }

  async extractDocumentFields(
    imageBytes: Uint8Array,
    mimeType: string,
    documentTypeHint: string | null
  ): Promise<AiExtractionResponse> {
    const base64 = Buffer.from(imageBytes).toString("base64");
    const imageDataUri = `data:${mimeType};base64,${base64}`;
    const prompt = buildGenericDocumentExtractionPrompt(documentTypeHint);
    const reasoningBudget = buildReasoningBudget();

    await this.rateLimiter.acquire();
    try {
      const response = await withRetry(
        () =>
          this.client.createExtractionCompletion({
            imageDataUri,
            prompt,
            temperature: 0.1,
            maxCompletionTokens: reasoningBudget.totalTokens,
          }),
        this.retryPolicy
      );

      const parsed = this.parseOrThrow(response.content);

      return {
        fields: parsed.fields ?? {},
        confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : null,
        tokenUsage: response.usage
          ? { promptTokens: response.usage.promptTokens, completionTokens: response.usage.completionTokens, totalTokens: response.usage.totalTokens }
          : null,
      };
    } finally {
      this.rateLimiter.release();
    }
  }

  private parseOrThrow(content: string): ParsedExtractionResponse {
    let parsed: unknown;
    try {
      parsed = this.parser.parse(content);
    } catch (error) {
      // Safe: the parser's own error already excludes raw content from the
      // thrown message in the caller-visible path; we do not log `content`
      // here either.
      const message = error instanceof Error ? error.message : String(error);
      throw new VisionValidationError(`Document extraction response failed shape validation: ${message}`, [message]);
    }
    if (!isParsedExtractionResponse(parsed)) {
      throw new VisionValidationError("Document extraction response was not a JSON object.", []);
    }
    return parsed;
  }
}

export interface CreateOpenAiDocumentProviderOptions {
  env?: NodeJS.ProcessEnv;
  rateLimiter?: RateLimiter;
  retryPolicy?: RetryPolicy;
}

/**
 * Builds an OpenAiDocumentExtractionProvider from environment variables:
 * OPENAI_API_KEY (required), OPENAI_MODEL (optional, defaults to
 * DEFAULT_DOCUMENT_EXTRACTION_MODEL). Throws synchronously if the key is
 * missing — same fail-fast convention as
 * createOpenAIVisionProviderFromEnv.
 */
export function createOpenAiDocumentProviderFromEnv(
  options: CreateOpenAiDocumentProviderOptions = {}
): OpenAiDocumentExtractionProvider {
  const env = options.env ?? process.env;
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required to create an OpenAiDocumentExtractionProvider");
  }
  const model = env.OPENAI_MODEL ?? DEFAULT_DOCUMENT_EXTRACTION_MODEL;
  const client = new SafeOpenAIDocumentClient({ apiKey, model });

  return new OpenAiDocumentExtractionProvider({
    client,
    rateLimiter: options.rateLimiter,
    retryPolicy: options.retryPolicy,
  });
}
