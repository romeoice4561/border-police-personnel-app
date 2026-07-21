/**
 * SafeOpenAIDocumentClient (Phase 48 — Tier 3 AI fallback transport).
 *
 * Deliberately NOT a reuse of lib/ai/openai_client.ts's HttpOpenAIClient:
 * that client unconditionally logs the full raw request diagnostics and
 * the ENTIRE raw HTTP response body (including the model's extracted text)
 * via `logRawHttpResponse`/`logRequestDiagnostics` — acceptable for the
 * bulk-import feature's personnel photos, but NOT acceptable here, where a
 * response can contain a Thai national ID number or other sensitive
 * identity data lifted straight off a document image (spec §18: "never
 * log full OCR text to console... never log national ID numbers").
 *
 * This client reuses every genuinely provider-agnostic, non-logging piece
 * (VisionResponse/error types, the request-building shape) but implements
 * its own transport with REDACTED logging: only counts, status codes, and
 * timing are logged — never response body content.
 *
 * No API key hardcoded — read from environment by the caller
 * (openai_document_provider.ts), same convention as openai_provider.ts.
 */

import type { VisionResponse } from "@/lib/ai/vision_response";
import { VisionProviderError, VisionRateLimit, VisionTimeout, VisionTokenLimitError } from "@/lib/ai/vision_errors";
import { safeTextPreview } from "@/lib/extraction/redaction";

export interface DocumentExtractionRequest {
  imageDataUri: string;
  prompt: string;
  temperature: number;
  maxCompletionTokens: number;
}

export interface SafeOpenAIDocumentClientConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_TIMEOUT_MS = 60_000;

export interface OpenAIDocumentClient {
  readonly model: string;
  createExtractionCompletion(request: DocumentExtractionRequest): Promise<VisionResponse>;
}

export class SafeOpenAIDocumentClient implements OpenAIDocumentClient {
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: SafeOpenAIDocumentClientConfig) {
    if (!config.apiKey) {
      throw new VisionProviderError("OpenAI API key was not provided to SafeOpenAIDocumentClient");
    }
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async createExtractionCompletion(request: DocumentExtractionRequest): Promise<VisionResponse> {
    const body = {
      model: this.model,
      temperature: request.temperature,
      max_completion_tokens: request.maxCompletionTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: request.prompt },
            { type: "image_url", image_url: { url: request.imageDataUri } },
          ],
        },
      ],
    };
    const serializedBody = JSON.stringify(body);

    // Safe: counts and estimated size only, never the prompt text or image
    // content (the prompt is a fixed template with no document content
    // embedded in it — see generic_document_prompt.ts — so logging its
    // LENGTH is safe; the image itself is never logged at all).
    console.log("[SafeOpenAIDocumentClient] sending extraction request:", {
      model: this.model,
      promptChars: request.prompt.length,
      requestBodyBytes: serializedBody.length,
      timeoutMs: this.timeoutMs,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: serializedBody,
        signal: controller.signal,
      });

      const rawBodyText = await response.text();
      const durationMs = Date.now() - startedAt;

      // Safe: status + timing + byte count only — never the body content.
      console.log("[SafeOpenAIDocumentClient] response received:", {
        status: response.status,
        durationMs,
        responseBodyBytes: rawBodyText.length,
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
          throw new VisionRateLimit(`OpenAI rate limit exceeded (status ${response.status})`, retryAfterMs);
        }
        // Error bodies from OpenAI (invalid request, auth failure, etc.) do
        // not contain document content, only API-level error messages —
        // safe to include in the thrown error for operator debugging.
        throw new VisionProviderError(`OpenAI document extraction request failed with status ${response.status}`, response.status);
      }

      const parsedBody = this.parseResponseBody(rawBodyText);
      return this.toVisionResponse(parsedBody);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new VisionTimeout(`OpenAI document extraction request exceeded timeout of ${this.timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponseBody(rawBodyText: string): {
    model: string;
    choices?: Array<{ message?: { content?: unknown; refusal?: string | null }; finish_reason?: string }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  } {
    try {
      return JSON.parse(rawBodyText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Safe: the parse-failure message never includes rawBodyText itself.
      throw new VisionProviderError(`OpenAI document extraction response is not valid JSON: ${message}`);
    }
  }

  private toVisionResponse(body: {
    model: string;
    choices?: Array<{ message?: { content?: unknown; refusal?: string | null }; finish_reason?: string }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }): VisionResponse {
    const choice = body.choices?.[0];

    if (choice?.finish_reason === "length") {
      throw new VisionTokenLimitError(
        "OpenAI document extraction response was truncated (finish_reason: length) before producing visible output."
      );
    }

    const message = choice?.message;
    if (message?.refusal) {
      // Safe: refusal reasons are model policy text, not document content.
      console.error("[SafeOpenAIDocumentClient] model returned a refusal instead of content:", message.refusal);
    }

    let content = "";
    const rawContent = message?.content;
    if (typeof rawContent === "string") {
      content = rawContent;
    } else if (Array.isArray(rawContent)) {
      content = rawContent
        .filter((part): part is { type: string; text: string } => !!part && typeof part === "object" && (part as { type?: string }).type === "text")
        .map((part) => part.text)
        .join("");
    }

    // Safe: length + short non-sensitive preview only, never the full content.
    const preview = safeTextPreview(content);
    console.log("[SafeOpenAIDocumentClient] extracted content:", preview);

    return {
      content,
      model: body.model,
      usage: body.usage
        ? { promptTokens: body.usage.prompt_tokens, completionTokens: body.usage.completion_tokens, totalTokens: body.usage.total_tokens }
        : undefined,
    };
  }
}
