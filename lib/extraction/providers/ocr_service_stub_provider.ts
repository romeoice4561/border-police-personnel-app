/**
 * Tier 2 OCR service provider — STUB (Phase 48 — spec §2).
 *
 * No low-cost OCR-only service (e.g. Google Cloud Vision text detection) is
 * configured or credentialed in this project yet. This stub exists so the
 * OcrServiceProvider interface is implemented and pluggable — the pipeline
 * can be wired to call Tier 2 the moment a real provider is configured,
 * with zero changes to the pipeline/gate logic — but it always throws
 * ExtractionProviderNotConfiguredError rather than silently returning a
 * fake result or falling through to a paid AI call.
 *
 * A future phase implementing Tier 2 for real should replace this file's
 * export with a real HTTP-backed implementation of OcrServiceProvider,
 * following the same "no API key hardcoded, read from env, throw at
 * construction if missing" pattern lib/ai/openai_provider.ts already
 * establishes.
 */

import { ExtractionProviderNotConfiguredError, type OcrServiceProvider } from "@/lib/extraction/providers/extraction_provider_types";

export class StubOcrServiceProvider implements OcrServiceProvider {
  readonly providerName = "ocr-service-stub";
  readonly providerVersion = null;

  async recognizeText(): Promise<{ text: string; confidence: number | null }> {
    throw new ExtractionProviderNotConfiguredError("Tier 2 OCR service (e.g. Google Cloud Vision)");
  }
}
