/**
 * ImageClassifier
 *
 * Top-level entry point for the Smart Image Classification Engine
 * (Phase 8.5). Gathers classification signals from the existing Layout
 * Detector and its underlying feature extractor (both already run before
 * any Vision call, per the Layout Intelligence Engine from Phase 2.5) and
 * an optional text sample provider, then delegates the actual decision to
 * `ClassificationEngine`.
 *
 * No OpenAI Vision calls are made anywhere in this module or its
 * dependencies — that is the entire point of running this stage first.
 */

import type { ImageInput } from "@/lib/layout/layout_types";
import { TemplateDetector } from "@/lib/layout/template_detector";
import { extractLayoutFeatures, StubFeatureExtractor, type FeatureExtractor } from "@/lib/layout/layout_features";
import { ClassificationEngine } from "@/lib/classifier/classification_engine";
import type {
  ClassificationSignals,
  ImageClassificationEngine,
  ImageClassificationResult,
} from "@/lib/classifier/classification_types";

/**
 * Contract for a lightweight text sample source, used only for the
 * keyword-based classification rules. Deliberately NOT an OCR/Vision API
 * call — this phase has no OCR implementation, so the default
 * `NullTextSampleProvider` always returns undefined, meaning only the
 * layout/feature-based rules can fire until a real lightweight text source
 * (e.g. a fast local OCR pass, distinct from the OpenAI Vision extraction
 * call) is introduced in a future phase.
 */
export interface TextSampleProvider {
  sample(image: ImageInput): Promise<string | undefined>;
}

/**
 * Default text sample provider: no lightweight OCR/text source exists in
 * this phase. Future extension point: back this with a fast local OCR
 * pass (not OpenAI Vision) so the keyword rules in classification_rules.ts
 * can fire on real extracted text.
 */
export class NullTextSampleProvider implements TextSampleProvider {
  async sample(): Promise<string | undefined> {
    return undefined;
  }
}

export interface ImageClassifierDependencies {
  layoutDetector?: TemplateDetector;
  featureExtractor?: FeatureExtractor;
  textSampleProvider?: TextSampleProvider;
  engine?: ImageClassificationEngine;
}

/**
 * Classifies a single image without ever calling OpenAI Vision. Reuses the
 * already-existing Layout Detector/feature extractor (no duplicated
 * layout-analysis logic) and combines their output with an optional text
 * sample into `ClassificationSignals`, then delegates to
 * `ClassificationEngine`.
 */
export class ImageClassifier {
  private readonly layoutDetector: TemplateDetector;
  private readonly featureExtractor: FeatureExtractor;
  private readonly textSampleProvider: TextSampleProvider;
  private readonly engine: ImageClassificationEngine;

  constructor(dependencies: ImageClassifierDependencies = {}) {
    this.layoutDetector = dependencies.layoutDetector ?? new TemplateDetector();
    this.featureExtractor = dependencies.featureExtractor ?? new StubFeatureExtractor();
    this.textSampleProvider = dependencies.textSampleProvider ?? new NullTextSampleProvider();
    this.engine = dependencies.engine ?? new ClassificationEngine();
  }

  async classify(image: ImageInput): Promise<ImageClassificationResult> {
    const [detection, features, textSample] = await Promise.all([
      this.layoutDetector.detect(image),
      extractLayoutFeatures(image, this.featureExtractor),
      this.textSampleProvider.sample(image),
    ]);

    const signals: ClassificationSignals = { detection, features, textSample };

    return this.engine.classify(signals);
  }
}
