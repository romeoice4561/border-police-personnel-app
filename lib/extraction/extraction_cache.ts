/**
 * Extraction result cache (Phase 48 — spec §6/§7).
 *
 * In-memory only for this phase, per explicit direction: "use an injectable
 * in-memory cache... prevent duplicate OCR/AI processing during runtime...
 * If persistent storage is required in a future phase, prepare a proposal
 * only." No schema change, no migration.
 *
 * Behind a clean interface (ExtractionCache) so a future phase can swap in a
 * database-backed implementation without touching the pipeline/gate logic
 * that consumes it — mirrors lib/ocr/ocr_cache.ts's OCRCache interface
 * exactly (get/set/size), extended to store the full pipeline result rather
 * than just an OCRResult.
 */

import type { ExtractionPipelineResult } from "@/lib/extraction/extraction_pipeline_types";

export interface ExtractionCacheEntry {
  cacheKey: string;
  result: ExtractionPipelineResult;
  cachedAt: string;
}

export interface ExtractionCacheLookup {
  hit: boolean;
  entry?: ExtractionCacheEntry;
}

export interface ExtractionCache {
  get(cacheKey: string): ExtractionCacheLookup;
  set(cacheKey: string, result: ExtractionPipelineResult): void;
  /** Number of distinct cache keys currently cached — surfaced for diagnostics/tests, never logged with content. */
  size(): number;
}

/**
 * In-memory extraction cache, process-lifetime only (cleared on server
 * restart — acceptable for this phase per the "in-memory only" decision;
 * a future phase can add a persisted implementation behind the same
 * interface with zero changes to callers).
 */
export class InMemoryExtractionCache implements ExtractionCache {
  private readonly entries = new Map<string, ExtractionCacheEntry>();

  get(cacheKey: string): ExtractionCacheLookup {
    const entry = this.entries.get(cacheKey);
    return entry ? { hit: true, entry } : { hit: false };
  }

  set(cacheKey: string, result: ExtractionPipelineResult): void {
    this.entries.set(cacheKey, { cacheKey, result, cachedAt: new Date().toISOString() });
  }

  size(): number {
    return this.entries.size;
  }
}
