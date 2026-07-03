/**
 * LayoutFeatures
 *
 * Extracts descriptive visual features from a source image, used as input
 * to both the LayoutClassifier and TemplateDetector. This module describes
 * *what the image looks like* (header position, photo size, text density,
 * timeline orientation, background style, dominant regions) — it does not
 * read or interpret personnel data. That is the AI Vision extractor's job
 * (see lib/ai), which runs only after layout has been resolved.
 *
 * No OCR and no external computer-vision libraries are used at this phase.
 * Feature extraction is a typed skeleton, ready to be backed by a real
 * image-analysis implementation in a later phase.
 */

import type { ImageInput, LayoutFeatureSet } from "@/lib/layout/layout_types";

/** Contract for a feature extraction backend. Allows swapping in a real CV pipeline later. */
export interface FeatureExtractor {
  extract(image: ImageInput): Promise<LayoutFeatureSet>;
}

/**
 * Placeholder extractor returning a neutral feature set.
 *
 * Future extension point: replace with an implementation backed by an image
 * analysis library or a lightweight CV model, without changing the
 * `FeatureExtractor` interface consumers depend on.
 */
export class StubFeatureExtractor implements FeatureExtractor {
  async extract(image: ImageInput): Promise<LayoutFeatureSet> {
    void image;

    return {
      headerPosition: undefined,
      photoRegion: undefined,
      textDensity: "moderate",
      timelineOrientation: "none",
      backgroundStyle: "unknown",
      dominantRegions: [],
      orientation: "portrait",
    };
  }
}

/**
 * Extracts layout features for an image using the provided extractor
 * (defaults to the stub). Downstream modules (classifier, detector) should
 * depend on this function rather than instantiating an extractor directly.
 */
export async function extractLayoutFeatures(
  image: ImageInput,
  extractor: FeatureExtractor = new StubFeatureExtractor()
): Promise<LayoutFeatureSet> {
  return extractor.extract(image);
}
