/**
 * OpenAIClient
 *
 * Thin HTTP wrapper around the OpenAI Chat Completions API (vision-capable
 * model), using the platform `fetch` — no `openai` SDK dependency is added
 * in this phase. Interface-first so a real SDK-backed client, or a
 * different provider entirely, can be substituted without touching
 * OpenAIVisionProvider.
 *
 * No API key is hardcoded anywhere in this file: the key is passed in via
 * constructor config, expected to be sourced from `process.env.OPENAI_API_KEY`
 * by the caller (see openai_provider.ts).
 */

import type { VisionRequest } from "@/lib/ai/vision_request";
import type { VisionResponse } from "@/lib/ai/vision_response";
import { VisionProviderError, VisionRateLimit, VisionTimeout, VisionTokenLimitError } from "@/lib/ai/vision_errors";

export interface OpenAIClientConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

/** Contract for the low-level OpenAI transport. Allows swapping in a real SDK client or a fake for tests. */
export interface OpenAIClient {
  readonly model: string;
  createVisionCompletion(request: VisionRequest): Promise<VisionResponse>;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Default request timeout. Overridable via `OpenAIClientConfig.timeoutMs`
 * or the `OPENAI_TIMEOUT_MS` environment variable (see
 * `createOpenAIVisionProviderFromEnv` in openai_provider.ts). Raised from
 * the original 30s default to 60s: reasoning-capable models (gpt-5.5) can
 * legitimately take longer than 30s to finish reasoning + produce output,
 * especially with a larger reasoning_budget (see reasoning_budget.ts) — the
 * old 30s default was a plausible contributor to spurious timeouts on
 * otherwise-healthy requests, not just a symptom of an actual hang. This is
 * a deliberate, logged default change, not a silent one (see
 * `logRequestConfig`).
 */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** Rough characters-per-token ratio for a quick prompt-size estimate in logs (see token_estimator.ts for the shared heuristic). */
const CHARS_PER_TOKEN_ESTIMATE = 4;

function estimateImageBytes(imagePath: string): number | undefined {
  const dataUriMatch = imagePath.match(/^data:[^;]+;base64,([\s\S]+)$/);
  if (!dataUriMatch) return undefined;

  // Base64 encodes 3 bytes as 4 characters; padding chars ('=') reduce the
  // final byte count slightly, accounted for below.
  const base64Payload = dataUriMatch[1];
  const paddingLength = (base64Payload.match(/=+$/) ?? [""])[0].length;
  return Math.floor((base64Payload.length * 3) / 4) - paddingLength;
}

/**
 * Model name prefixes that only support the default `temperature` (1) and
 * reject any explicit value with an `unsupported_value` error. Matched
 * against the start of the configured model name so future dated/versioned
 * variants (e.g. "gpt-5.5-2025-01-01") are still recognized.
 *
 * Future extension point: replace this prefix list with a proper
 * per-model capability table if more model-specific request differences
 * emerge (e.g. token limits, response formats).
 */
const FIXED_TEMPERATURE_MODEL_PREFIXES = ["gpt-5.5", "gpt-5", "o1", "o3"];

function modelSupportsTemperature(model: string): boolean {
  return !FIXED_TEMPERATURE_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix));
}

/**
 * A single content part within a `message.content` array. The Chat
 * Completions API uses this shape for multi-part messages (mirroring what
 * we send in requests: text + image_url parts). Some models/response
 * configurations return `message.content` as this array form instead of a
 * plain string, even for text-only assistant replies — see
 * `extractMessageContent` below.
 */
interface ChatCompletionContentPart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * `message.content` is typed `unknown` rather than `string` because the
 * real API is observed to return either a plain string, an array of
 * content parts, or `null` (e.g. when the model instead populates
 * `refusal`) depending on model/response configuration. Trusting a
 * `string`-only type here was the root cause of silently-empty assistant
 * messages: `content ?? ""` treated a non-string value as valid content
 * without ever converting it to text.
 */
interface ChatCompletionMessage {
  content: unknown;
  refusal?: string | null;
  [key: string]: unknown;
}

interface ChatCompletionChoice {
  message: ChatCompletionMessage;
  finish_reason?: string;
  [key: string]: unknown;
}

interface ChatCompletionResponseBody {
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /** Reasoning-capable models (gpt-5.5, o1, o3, ...) report reasoning token spend here, nested under completion_tokens_details. */
    completion_tokens_details?: {
      reasoning_tokens?: number;
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

/**
 * Default OpenAIClient implementation, calling the Chat Completions API
 * directly via `fetch`.
 *
 * Future extension point: swap to the official `openai` SDK, or add
 * support for the Responses API, behind this same `OpenAIClient` interface.
 */
export class HttpOpenAIClient implements OpenAIClient {
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: OpenAIClientConfig) {
    if (!config.apiKey) {
      throw new VisionProviderError("OpenAI API key was not provided to OpenAIClient");
    }

    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async createVisionCompletion(request: VisionRequest): Promise<VisionResponse> {
    const requestBody = this.buildRequestBody(request);
    const serializedBody = JSON.stringify(requestBody);

    this.logRequestDiagnostics(request, serializedBody);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const timestamps = { requestStarted: Date.now() } as {
      requestStarted: number;
      requestSent?: number;
      firstResponseByte?: number;
      responseCompleted?: number;
    };

    try {
      timestamps.requestSent = Date.now();

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: serializedBody,
        signal: controller.signal,
      });

      // fetch() resolves once the response headers arrive, before the body
      // is read — this is the closest available approximation of "first
      // response byte" without a lower-level streaming read.
      timestamps.firstResponseByte = Date.now();

      const rawBodyText = await response.text();
      timestamps.responseCompleted = Date.now();

      this.logTimingBreakdown(timestamps);
      this.logRawHttpResponse(response, rawBodyText);

      if (!response.ok) {
        await this.handleErrorResponse(response, rawBodyText);
      }

      const body = this.parseResponseBody(rawBodyText);
      return this.toVisionResponse(body, rawBodyText);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        this.logTimingBreakdown(timestamps, /* timedOut */ true);
        throw new VisionTimeout(
          `OpenAI request exceeded timeout of ${this.timeoutMs}ms. ` +
            "See '[HttpOpenAIClient] timing breakdown' above to determine which phase " +
            "(pre-request, network send, waiting for OpenAI, or body transfer) did not complete. " +
            "Configure a longer timeout via the OPENAI_TIMEOUT_MS environment variable if OpenAI " +
            "processing time (not a client/network issue) is the cause."
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Logs everything needed to distinguish "prompt too big / budget too
   * large" causes of a slow request from "client/network" causes, before
   * the request is even sent.
   */
  private logRequestDiagnostics(request: VisionRequest, serializedBody: string): void {
    const promptChars = request.prompt.length;
    const estimatedPromptTokens = Math.ceil(promptChars / CHARS_PER_TOKEN_ESTIMATE);
    const imageBytes = estimateImageBytes(request.imagePath);

    console.log("[HttpOpenAIClient] request diagnostics:", {
      model: this.model,
      configured_timeout_ms: this.timeoutMs,
      prompt_characters: promptChars,
      estimated_prompt_tokens: estimatedPromptTokens,
      image_bytes: imageBytes ?? "unknown (not a data: URI)",
      request_body_bytes: serializedBody.length,
      max_completion_tokens: request.reasoningBudget.totalTokens,
      reasoning_tokens_budget: request.reasoningBudget.reasoningTokens,
      output_tokens_budget: request.reasoningBudget.outputTokens,
    });
  }

  /**
   * Logs the four timestamps requested for timeout root-causing: request
   * started, request sent, first response byte (headers received), and
   * response completed (full body read) — plus the derived duration of
   * each phase, so it's possible to tell whether time was spent before the
   * request even left the client, in network transit, waiting on OpenAI to
   * process, or streaming the response body.
   */
  private logTimingBreakdown(
    timestamps: {
      requestStarted: number;
      requestSent?: number;
      firstResponseByte?: number;
      responseCompleted?: number;
    },
    timedOut = false
  ): void {
    const { requestStarted, requestSent, firstResponseByte, responseCompleted } = timestamps;

    console.log(`[HttpOpenAIClient] timing breakdown${timedOut ? " (TIMED OUT)" : ""}:`, {
      request_started_at: new Date(requestStarted).toISOString(),
      request_sent_at: requestSent !== undefined ? new Date(requestSent).toISOString() : undefined,
      first_response_byte_at:
        firstResponseByte !== undefined ? new Date(firstResponseByte).toISOString() : "not received before timeout/error",
      response_completed_at:
        responseCompleted !== undefined ? new Date(responseCompleted).toISOString() : "not completed before timeout/error",
      pre_request_setup_ms: requestSent !== undefined ? requestSent - requestStarted : undefined,
      waiting_for_openai_ms:
        firstResponseByte !== undefined && requestSent !== undefined ? firstResponseByte - requestSent : undefined,
      body_transfer_ms:
        responseCompleted !== undefined && firstResponseByte !== undefined
          ? responseCompleted - firstResponseByte
          : undefined,
      total_elapsed_ms: Date.now() - requestStarted,
    });
  }

  private buildRequestBody(request: VisionRequest) {
    return {
      model: this.model,
      ...(modelSupportsTemperature(this.model) ? { temperature: request.temperature } : {}),
      max_completion_tokens: request.reasoningBudget.totalTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: request.prompt },
            { type: "image_url", image_url: { url: request.imagePath } },
          ],
        },
      ],
    };
  }

  /**
   * Prints the complete raw HTTP response — status, headers, and body —
   * before any parsing happens, so the actual wire response is always
   * inspectable regardless of what downstream extraction does with it.
   */
  private logRawHttpResponse(response: Response, rawBodyText: string): void {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    console.log("[HttpOpenAIClient] raw HTTP response:");
    console.log("  status:", response.status, response.statusText);
    console.log("  headers:", JSON.stringify(headers, null, 2));
    console.log("  body:", rawBodyText);
  }

  private parseResponseBody(rawBodyText: string): ChatCompletionResponseBody {
    try {
      return JSON.parse(rawBodyText) as ChatCompletionResponseBody;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new VisionProviderError(`OpenAI response body is not valid JSON: ${message}. Raw body: ${rawBodyText}`);
    }
  }

  private async handleErrorResponse(response: Response, rawBodyText: string): Promise<never> {
    const status = response.status;

    if (status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
      throw new VisionRateLimit(`OpenAI rate limit exceeded (status ${status})`, retryAfterMs);
    }

    throw new VisionProviderError(`OpenAI request failed with status ${status}: ${rawBodyText}`, status);
  }

  /**
   * Extracts the assistant's text content from `message.content`,
   * tolerating every shape observed from the Chat Completions API:
   * - a plain string (the "classic" shape),
   * - an array of content parts (each `{ type: "text", text: "..." }`,
   *   plus possible non-text parts like image blocks, which are skipped),
   * - `null`/missing, e.g. when the model populated `refusal` instead.
   *
   * If none of these produce any text, the entire response body is logged
   * so an unexpected/future schema change is immediately visible rather
   * than silently producing an empty string.
   */
  private extractMessageContent(choice: ChatCompletionChoice | undefined, fullBodyForLogging: string): string {
    const message = choice?.message;

    if (message?.refusal) {
      console.error("[HttpOpenAIClient] model returned a refusal instead of content:", message.refusal);
      return "";
    }

    const content = message?.content;

    let extracted: string;
    if (typeof content === "string") {
      extracted = content;
    } else if (Array.isArray(content)) {
      extracted = (content as ChatCompletionContentPart[])
        .filter((part) => part && part.type === "text" && typeof part.text === "string")
        .map((part) => part.text as string)
        .join("");
    } else {
      extracted = "";
    }

    console.log("[HttpOpenAIClient] extracted assistant payload:", JSON.stringify(extracted));

    if (extracted.length === 0) {
      console.error(
        "[HttpOpenAIClient] assistant message content extracted as empty. " +
          "message.content shape was:", JSON.stringify(content),
        "\nFull response body for inspection:\n", fullBodyForLogging
      );
    }

    return extracted;
  }

  /**
   * Logs the token/finish-reason accounting for a response: `finish_reason`,
   * `completion_tokens`, `reasoning_tokens` (if the model reports them),
   * and the derived visible output tokens (completion minus reasoning).
   * This is the diagnostic trail for the "model spent its whole budget on
   * reasoning" failure mode this fix addresses.
   */
  private logCompletionAccounting(choice: ChatCompletionChoice | undefined, body: ChatCompletionResponseBody): void {
    const finishReason = choice?.finish_reason ?? "unknown";
    const completionTokens = body.usage?.completion_tokens;
    const reasoningTokens = body.usage?.completion_tokens_details?.reasoning_tokens;
    const outputTokens =
      completionTokens !== undefined && reasoningTokens !== undefined
        ? completionTokens - reasoningTokens
        : undefined;

    console.log("[HttpOpenAIClient] completion accounting:", {
      finish_reason: finishReason,
      completion_tokens: completionTokens,
      reasoning_tokens: reasoningTokens,
      output_tokens: outputTokens,
    });
  }

  /**
   * Throws VisionTokenLimitError when the response was truncated by the
   * completion token budget (`finish_reason: "length"`) — most commonly
   * because a reasoning-capable model spent its entire budget on internal
   * reasoning, leaving nothing for visible output (the bug this addresses:
   * finish_reason "length", empty content, completion_tokens ==
   * reasoning_tokens == the configured max). This is checked and thrown
   * *before* JSON-shape validation, so it surfaces as a distinct, actionable
   * error rather than a generic parse failure.
   */
  private assertNotTruncated(choice: ChatCompletionChoice | undefined, body: ChatCompletionResponseBody): void {
    if (choice?.finish_reason !== "length") return;

    const completionTokens = body.usage?.completion_tokens;
    const reasoningTokens = body.usage?.completion_tokens_details?.reasoning_tokens;
    const configuredBudget = completionTokens ?? "unknown";

    throw new VisionTokenLimitError(
      `OpenAI response was truncated (finish_reason: "length") before producing visible output. ` +
        `completion_tokens=${completionTokens ?? "unknown"}, reasoning_tokens=${reasoningTokens ?? "unknown"}. ` +
        `The model likely spent its entire completion token budget (${configuredBudget}) on internal reasoning. ` +
        "Recommend increasing max_completion_tokens (via VisionRequestOptions.reasoningBudget) to a larger value " +
        "so there is room left for visible output after reasoning.",
      completionTokens,
      reasoningTokens
    );
  }

  private toVisionResponse(body: ChatCompletionResponseBody, rawBodyText: string): VisionResponse {
    const choice = body.choices?.[0];

    this.logCompletionAccounting(choice, body);
    this.assertNotTruncated(choice, body);

    const content = this.extractMessageContent(choice, rawBodyText);

    return {
      content,
      model: body.model,
      usage: body.usage
        ? {
            promptTokens: body.usage.prompt_tokens,
            completionTokens: body.usage.completion_tokens,
            totalTokens: body.usage.total_tokens,
          }
        : undefined,
    };
  }
}
