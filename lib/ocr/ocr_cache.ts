/**
 * OCR cache (Phase 10A).
 *
 * Keyed by image content hash: if a hash has been OCR'd before, its
 * OCRResult is reused rather than recomputed — the same image is never OCR'd
 * twice. Mirrors the existing layout TemplateCache pattern (hash -> result),
 * kept behind an interface so an in-memory cache (default), a persisted
 * cache, or a test fake are interchangeable.
 *
 * Content hashing lives here (crypto SHA-256 over the image bytes) so the
 * engine can compute a hash when the caller doesn't supply one, without
 * duplicating hashing logic across modules.
 */

import { createHash } from "node:crypto";
import type { OCRResult } from "@/lib/ocr/ocr_types";

export interface OCRCacheEntry {
  hash: string;
  result: OCRResult;
  cachedAt: string;
}

export interface OCRCacheLookup {
  hit: boolean;
  entry?: OCRCacheEntry;
}

/** Contract for an OCR result cache. Allows swapping in a persisted cache later. */
export interface OCRCache {
  get(hash: string): OCRCacheLookup;
  set(hash: string, result: OCRResult): void;
  /** Number of distinct hashes currently cached. */
  size(): number;
}

/**
 * In-memory OCR cache. Default implementation, suitable for a single batch
 * run where the same image may be encountered more than once (e.g. a resume
 * pass or a duplicate file).
 */
export class InMemoryOCRCache implements OCRCache {
  private readonly entries = new Map<string, OCRCacheEntry>();

  get(hash: string): OCRCacheLookup {
    const entry = this.entries.get(hash);
    return entry ? { hit: true, entry } : { hit: false };
  }

  set(hash: string, result: OCRResult): void {
    this.entries.set(hash, { hash, result, cachedAt: new Date().toISOString() });
  }

  size(): number {
    return this.entries.size;
  }
}

/** Computes the SHA-256 content hash used as the OCR cache key. */
export function hashImageBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
