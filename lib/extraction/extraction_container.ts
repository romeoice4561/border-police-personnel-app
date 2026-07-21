/**
 * Extraction container (Phase 48).
 *
 * Mirrors lib/document/document_container.ts's DI factory pattern exactly:
 * a pure `createExtractionContainer(deps)` builder plus a cached
 * `getExtractionContainer()` resolver that never throws — Tier 3 AI is
 * wired only when OPENAI_API_KEY is configured; when it's absent, a stub
 * that throws ExtractionProviderNotConfiguredError only when actually
 * invoked is injected instead (so OCR-only extraction keeps working with
 * zero AI configured, exactly like document_container.ts's storage stub
 * keeps DB-only operations working with zero Storage configured).
 *
 * The extraction cache and usage meter are process-lifetime in-memory
 * singletons for this phase (no persistence — see extraction_cache.ts's
 * header comment for the explicit "propose, don't persist yet" decision).
 */

import { TesseractOCREngine } from "@/lib/ocr/tesseract_engine";
import { CachingOCREngine } from "@/lib/ocr/ocr_engine";
import type { OCREngine } from "@/lib/ocr/ocr_types";
import { InMemoryExtractionCache, type ExtractionCache } from "@/lib/extraction/extraction_cache";
import { InMemoryUsageMeter, type UsageMeter } from "@/lib/extraction/usage_meter";
import { DEFAULT_AI_USAGE_POLICY, type AiUsagePolicy } from "@/lib/extraction/budget_policy";
import { DEFAULT_CONFIDENCE_POLICY, type ConfidencePolicy } from "@/lib/extraction/confidence";
import { DEFAULT_GOVERNANCE_POLICY, type GovernancePolicy } from "@/lib/extraction/governance_policy";
import { InMemoryObservabilityEmitter, type ObservabilityEmitter } from "@/lib/extraction/observability";
import { InMemoryProcessingQueue, type ProcessingQueue } from "@/lib/extraction/processing_queue";
import type { AiExtractionProvider } from "@/lib/extraction/providers/extraction_provider_types";
import { ExtractionProviderNotConfiguredError } from "@/lib/extraction/providers/extraction_provider_types";
import { createOpenAiDocumentProviderFromEnv } from "@/lib/extraction/providers/openai_document_provider";

export interface ExtractionContainer {
  ocrEngine: OCREngine;
  cache: ExtractionCache;
  usageMeter: UsageMeter;
  aiProvider: AiExtractionProvider;
  aiProviderConfigured: boolean;
  usagePolicy: AiUsagePolicy;
  confidencePolicy: ConfidencePolicy;
  governancePolicy: GovernancePolicy;
  observability: ObservabilityEmitter;
  queue: ProcessingQueue;
}

export function createExtractionContainer(deps: {
  ocrEngine?: OCREngine;
  cache?: ExtractionCache;
  usageMeter?: UsageMeter;
  aiProvider?: AiExtractionProvider;
  aiProviderConfigured?: boolean;
  usagePolicy?: AiUsagePolicy;
  confidencePolicy?: ConfidencePolicy;
  governancePolicy?: GovernancePolicy;
  observability?: ObservabilityEmitter;
  queue?: ProcessingQueue;
} = {}): ExtractionContainer {
  const cache = deps.cache ?? new InMemoryExtractionCache();
  const baseOcrEngine = deps.ocrEngine ?? new TesseractOCREngine();
  // Wrap in CachingOCREngine (Tier 1's own hash-keyed cache — Phase 10A) so
  // even a "cache miss" at the extraction_cache.ts level (e.g. a rules
  // version bump invalidated the extraction result but the underlying
  // image is unchanged) still avoids a redundant raw OCR pass.
  const ocrEngine = deps.ocrEngine ?? new CachingOCREngine({ baseEngine: baseOcrEngine });

  let aiProvider = deps.aiProvider;
  let aiProviderConfigured = deps.aiProviderConfigured ?? false;
  if (!aiProvider) {
    try {
      aiProvider = createOpenAiDocumentProviderFromEnv();
      aiProviderConfigured = true;
    } catch {
      aiProviderConfigured = false;
      aiProvider = {
        providerName: "openai-not-configured",
        modelName: "none",
        promptSchemaVersion: "none",
        async extractDocumentFields() {
          throw new ExtractionProviderNotConfiguredError("Tier 3 AI provider (OpenAI)");
        },
      };
    }
  }

  return {
    ocrEngine,
    cache,
    usageMeter: deps.usageMeter ?? new InMemoryUsageMeter(),
    aiProvider,
    aiProviderConfigured,
    usagePolicy: deps.usagePolicy ?? DEFAULT_AI_USAGE_POLICY,
    confidencePolicy: deps.confidencePolicy ?? DEFAULT_CONFIDENCE_POLICY,
    governancePolicy: deps.governancePolicy ?? DEFAULT_GOVERNANCE_POLICY,
    observability: deps.observability ?? new InMemoryObservabilityEmitter(),
    queue: deps.queue ?? new InMemoryProcessingQueue(),
  };
}

let cachedContainer: ExtractionContainer | undefined;

/**
 * Returns the process-lifetime ExtractionContainer, building it on first
 * call. Never throws — mirrors getDocumentContainer()'s "always returns a
 * container, degrades gracefully when a provider isn't configured" rule.
 */
export function getExtractionContainer(): ExtractionContainer {
  if (!cachedContainer) {
    cachedContainer = createExtractionContainer();
  }
  return cachedContainer;
}
