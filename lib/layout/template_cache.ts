/**
 * TemplateCache
 *
 * Caches TemplateDetectionResult by image hash so repeated detections of
 * the same (or byte-identical) image skip re-running feature extraction,
 * classification, and detection.
 *
 * This phase implements an in-memory cache only. Persistence (e.g. to
 * Supabase or disk) is a named future extension point — see
 * docs/LAYOUT_ENGINE.md.
 */

import type {
  CacheLookupResult,
  ImageInput,
  TemplateCacheEntry,
  TemplateDetectionResult,
} from "@/lib/layout/layout_types";

/** Contract for a template cache backend. Allows swapping in a persisted cache later. */
export interface TemplateCacheStore {
  lookup(hash: string): CacheLookupResult;
  set(hash: string, result: TemplateDetectionResult): void;
  clear(): void;
}

/**
 * In-memory template cache keyed by image hash.
 *
 * Future extension point: add a persistence-backed implementation (e.g.
 * Supabase table or on-disk store) behind the same `TemplateCacheStore`
 * interface, without changing callers.
 */
export class InMemoryTemplateCache implements TemplateCacheStore {
  private readonly entries = new Map<string, TemplateCacheEntry>();

  lookup(hash: string): CacheLookupResult {
    const entry = this.entries.get(hash);
    return entry ? { hit: true, entry } : { hit: false };
  }

  set(hash: string, result: TemplateDetectionResult): void {
    this.entries.set(hash, {
      hash,
      result,
      cachedAt: new Date().toISOString(),
    });
  }

  clear(): void {
    this.entries.clear();
  }
}

/**
 * Computes a stable hash for an image input, used as the cache key.
 *
 * Placeholder implementation: uses the provided hash if present, otherwise
 * falls back to the image source string. A future phase should replace this
 * with a real content hash (e.g. SHA-256 of image bytes).
 */
export function computeImageHash(image: ImageInput): string {
  return image.hash ?? image.source;
}
