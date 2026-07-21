/**
 * Extraction provider tiers (Phase 48 — spec §2).
 *
 * Provider-agnostic contracts for Tier 2 (low-cost OCR-only service) and
 * Tier 3 (paid AI structured extraction). Tier 1 (local Tesseract) already
 * has its own contract at lib/ocr/ocr_types.ts's OCREngine — reused as-is,
 * not duplicated here.
 *
 * Pure domain typing — no I/O, no React, no provider SDK imports.
 */

/** Tier 2: text-recognition-only. No generative analysis — see spec §2 ("This tier should extract text only"). */
export interface OcrServiceProvider {
  readonly providerName: string;
  readonly providerVersion: string | null;
  recognizeText(imageBytes: Uint8Array, mimeType: string): Promise<{ text: string; confidence: number | null }>;
}

/** Tier 3: paid AI structured extraction over a generic document image — distinct from lib/ai/vision_extractor.ts's personnel-specific extractor. */
export interface AiExtractionProvider {
  readonly providerName: string;
  readonly modelName: string;
  /** Bumped whenever the prompt or expected response schema changes — part of the cache key (fingerprint.ts's CacheKeyInput.aiPromptSchemaVersion). */
  readonly promptSchemaVersion: string;
  extractDocumentFields(
    imageBytes: Uint8Array,
    mimeType: string,
    documentTypeHint: string | null
  ): Promise<AiExtractionResponse>;
}

export interface AiExtractionResponse {
  /** Raw field-name -> value pairs as returned by the model — mapped onto ExtractedField by the caller, never trusted/saved directly. */
  fields: Record<string, string | null>;
  /** Model-reported confidence, 0-1, if the schema asks for and receives one. null when not returned. */
  confidence: number | null;
  /** Only populated when the provider's response actually reports usage — never estimated. */
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}

export class ExtractionProviderNotConfiguredError extends Error {
  constructor(providerName: string) {
    super(`${providerName} is not configured. Set the required environment variable(s) before using this provider.`);
    this.name = "ExtractionProviderNotConfiguredError";
  }
}
