/**
 * OCR engine composition (Phase 10A).
 *
 * `CachingOCREngine` is a decorator over any base `OCREngine` (normally the
 * TesseractOCREngine) that adds hash-keyed caching: it computes the image's
 * content hash (or uses one supplied via options), returns a cached
 * OCRResult when present, and otherwise delegates to the base engine and
 * stores the fresh result. This is where the "never OCR the same image
 * twice" rule lives — kept separate from the Tesseract runtime so the
 * caching behaviour is unit-testable with a fake base engine and no real OCR.
 *
 * It also exposes the last lookup's source (cache | fresh) via a callback so
 * a caller/statistics builder can record cache hit rate without the engine
 * needing to know about statistics.
 *
 * Dependency injection throughout: base engine, cache, and file reader are
 * all injected. No singleton, no module-level state.
 */

import fs from "node:fs";
import type { OCREngine, OCROptions, OCRResult, OCRSource } from "@/lib/ocr/ocr_types";
import { hashImageBytes, InMemoryOCRCache, type OCRCache } from "@/lib/ocr/ocr_cache";

/** Reads an image file's bytes. Injected so tests need no real files. */
export type ImageByteReader = (imagePath: string) => Uint8Array;

const defaultByteReader: ImageByteReader = (imagePath) => fs.readFileSync(imagePath);

export interface CachingOCREngineDependencies {
  /** The engine that actually performs OCR on a cache miss (e.g. TesseractOCREngine). */
  baseEngine: OCREngine;
  /** Result cache. Defaults to a fresh in-memory cache. */
  cache?: OCRCache;
  /** Reads image bytes to compute a content hash when none is supplied. Defaults to fs.readFileSync. */
  readBytes?: ImageByteReader;
  /** Optional callback invoked after each recognize() with whether the result was a cache hit or fresh. */
  onResolved?: (result: OCRResult, source: OCRSource) => void;
}

export class CachingOCREngine implements OCREngine {
  private readonly baseEngine: OCREngine;
  private readonly cache: OCRCache;
  private readonly readBytes: ImageByteReader;
  private readonly onResolved?: (result: OCRResult, source: OCRSource) => void;

  constructor(dependencies: CachingOCREngineDependencies) {
    this.baseEngine = dependencies.baseEngine;
    this.cache = dependencies.cache ?? new InMemoryOCRCache();
    this.readBytes = dependencies.readBytes ?? defaultByteReader;
    this.onResolved = dependencies.onResolved;
  }

  async recognize(imagePath: string, options?: OCROptions): Promise<OCRResult> {
    const hash = options?.hash ?? hashImageBytes(this.readBytes(imagePath));

    const lookup = this.cache.get(hash);
    if (lookup.hit && lookup.entry) {
      this.onResolved?.(lookup.entry.result, "cache");
      return lookup.entry.result;
    }

    const result = await this.baseEngine.recognize(imagePath, { ...options, hash });
    this.cache.set(hash, result);
    this.onResolved?.(result, "fresh");
    return result;
  }
}
