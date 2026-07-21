/**
 * File fingerprinting (Phase 48 — Cost-Efficient OCR & Selective AI
 * Extraction).
 *
 * A SHA-256 content hash of the uploaded file's bytes, used to detect exact
 * duplicates and to key the extraction cache (see extraction_cache.ts). This
 * mirrors lib/ocr/ocr_cache.ts's `hashImageBytes` pattern exactly (same
 * algorithm, same "hash the bytes, never the filename" rule) rather than
 * reintroducing a second hashing convention — kept as its own function here
 * (not imported from ocr_cache.ts) because the extraction pipeline's cache
 * key is a composite of MORE than just the file hash (see buildCacheKey
 * below), and this module owns that composite, not raw OCR caching.
 *
 * Pure — no I/O, no React.
 */

import { createHash } from "node:crypto";

/** SHA-256 hex digest of the file's raw bytes. */
export function fingerprintBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Composite cache key components (spec §6): the file fingerprint alone is
 * NOT a sufficient cache key, because the same file processed with a
 * different OCR engine version, a different extraction-rules version, or a
 * different AI model must not silently reuse a stale result. Every field
 * here must change whenever the corresponding processing logic changes.
 */
export interface CacheKeyInput {
  fileFingerprint: string;
  ocrProvider: string;
  /** e.g. the OCR engine's package version, or a manually bumped string if unavailable. */
  ocrProviderVersion?: string;
  /** Bumped whenever field_extractors/normalization/validation logic changes meaningfully. */
  extractionRulesVersion: string;
  /** Set only when an AI fallback was actually used for this result. */
  aiProviderModel?: string;
  /** Bumped whenever the AI prompt or expected response schema changes. */
  aiPromptSchemaVersion?: string;
}

/**
 * Builds the composite cache key string from CacheKeyInput. Deterministic —
 * identical input always produces an identical key, and any field change
 * changes the key (so a rules/prompt/version bump naturally invalidates
 * stale cache entries without needing an explicit cache-clear step).
 */
export function buildCacheKey(input: CacheKeyInput): string {
  const parts = [
    `fp:${input.fileFingerprint}`,
    `ocr:${input.ocrProvider}`,
    `ocrv:${input.ocrProviderVersion ?? "unknown"}`,
    `rules:${input.extractionRulesVersion}`,
    `ai:${input.aiProviderModel ?? "none"}`,
    `aischema:${input.aiPromptSchemaVersion ?? "none"}`,
  ];
  return parts.join("|");
}
