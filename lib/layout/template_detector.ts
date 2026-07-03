/**
 * TemplateDetector
 *
 * Top-level entry point for the Layout Intelligence Engine. Given a single
 * image, determines which known template it most closely matches (or
 * "unknown" if none matches confidently), before AI Vision extraction runs.
 *
 * Pipeline: extract features -> classify category -> match against
 * registered templates -> cache result.
 */

import type { ImageInput, TemplateDetectionResult } from "@/lib/layout/layout_types";
import {
  extractLayoutFeatures,
  StubFeatureExtractor,
  type FeatureExtractor,
} from "@/lib/layout/layout_features";
import {
  classifyLayout,
  HeuristicLayoutClassifier,
  type LayoutClassifierEngine,
} from "@/lib/layout/layout_classifier";
import {
  createDefaultLayoutRegistry,
  type LayoutRegistryStore,
} from "@/lib/layout/layout_registry";
import {
  computeImageHash,
  InMemoryTemplateCache,
  type TemplateCacheStore,
} from "@/lib/layout/template_cache";

/** Dependencies the TemplateDetector orchestrates. All are swappable for future real implementations. */
export interface TemplateDetectorDependencies {
  featureExtractor?: FeatureExtractor;
  classifier?: LayoutClassifierEngine;
  registry?: LayoutRegistryStore;
  cache?: TemplateCacheStore;
}

/**
 * Detects the template of a single personnel profile image.
 *
 * Future extension points:
 * - Replace the stub feature extractor / heuristic classifier with real
 *   computer-vision-backed implementations.
 * - Persist the registry and cache instead of holding them in memory.
 * - Add per-region template priors (the four Border Patrol regions may
 *   favor different template families).
 */
export class TemplateDetector {
  private readonly featureExtractor: FeatureExtractor;
  private readonly classifier: LayoutClassifierEngine;
  private readonly registry: LayoutRegistryStore;
  private readonly cache: TemplateCacheStore;

  constructor(dependencies: TemplateDetectorDependencies = {}) {
    this.featureExtractor = dependencies.featureExtractor ?? new StubFeatureExtractor();
    this.classifier = dependencies.classifier ?? new HeuristicLayoutClassifier();
    this.registry = dependencies.registry ?? createDefaultLayoutRegistry();
    this.cache = dependencies.cache ?? new InMemoryTemplateCache();
  }

  /**
   * Runs the full detection pipeline for a single image, using the cache
   * when a matching hash has been seen before.
   */
  async detect(image: ImageInput): Promise<TemplateDetectionResult> {
    const hash = computeImageHash(image);
    const cached = this.cache.lookup(hash);
    if (cached.hit && cached.entry) {
      return cached.entry.result;
    }

    const features = await extractLayoutFeatures(image, this.featureExtractor);
    const classification = await classifyLayout(features, this.classifier);

    const result = this.resolveTemplate(classification.best.category, classification.best.confidence, features);

    this.cache.set(hash, result);
    this.registry.recordDetection(result.template_id, new Date().toISOString());

    return result;
  }

  /**
   * Resolves a specific template_id/version within a classified category.
   *
   * Placeholder resolution: picks the highest-usage registered template in
   * the category, or falls back to "unknown". A future phase should refine
   * this using LayoutFeatureSet signals (e.g. matching against each
   * template's `expectedFields`) rather than usage count alone.
   */
  private resolveTemplate(
    category: TemplateDetectionResult["category"],
    confidence: number,
    features: Awaited<ReturnType<FeatureExtractor["extract"]>>
  ): TemplateDetectionResult {
    const candidates = this.registry.list().filter((t) => t.category === category);
    const chosen = candidates.sort((a, b) => b.usageCount - a.usageCount)[0];

    if (!chosen) {
      return {
        template_id: "unknown",
        confidence: Math.min(confidence, 20),
        category: "Unknown",
        version: "0",
        orientation: features.orientation,
      };
    }

    return {
      template_id: chosen.template_id,
      confidence,
      category: chosen.category,
      version: chosen.version,
      orientation: features.orientation,
    };
  }
}
