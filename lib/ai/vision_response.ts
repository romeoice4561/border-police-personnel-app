/**
 * VisionResponse
 *
 * Provider-agnostic shape of a raw Vision call result: the text content
 * returned by the model plus whatever usage/token accounting the provider
 * reports. response_parser.ts turns `content` into structured JSON;
 * token_estimator.ts / cost_estimator.ts consume `usage` when present, or
 * fall back to estimation when a provider doesn't report it.
 */

export interface VisionResponseUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface VisionResponse {
  content: string;
  usage?: VisionResponseUsage;
  model: string;
}
