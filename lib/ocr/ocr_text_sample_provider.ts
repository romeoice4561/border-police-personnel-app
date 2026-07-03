/**
 * OcrTextSampleProvider (Phase 10A integration seam).
 *
 * Adapts the OCR layer to the classifier's existing `TextSampleProvider`
 * contract (lib/classifier/image_classifier.ts) — the exact seam the Phase
 * 8.5 classifier already reads its `textSample` from. Injecting this in place
 * of the default `NullTextSampleProvider` is the ONLY change needed to feed
 * real OCR text into classification; no classifier, rule, or Vision code is
 * modified.
 *
 * Returns the OCR `fullText` (or undefined when OCR found nothing, so the
 * keyword rules simply don't fire, matching NullTextSampleProvider's
 * behaviour on a blank result). Passes through `ImageInput.hash` so the OCR
 * cache can reuse a prior result for the same image.
 *
 * DI: the OCR engine is injected — no singleton, no global OCR instance.
 */

import type { ImageInput } from "@/lib/layout/layout_types";
import type { TextSampleProvider } from "@/lib/classifier/image_classifier";
import type { OCREngine, OCRLanguage } from "@/lib/ocr/ocr_types";

export interface OcrTextSampleProviderConfig {
  engine: OCREngine;
  /** Language mode for the classification OCR pass. Defaults to "mixed" (Thai + English). */
  language?: OCRLanguage;
}

export class OcrTextSampleProvider implements TextSampleProvider {
  private readonly engine: OCREngine;
  private readonly language: OCRLanguage;

  constructor(config: OcrTextSampleProviderConfig) {
    this.engine = config.engine;
    this.language = config.language ?? "mixed";
  }

  async sample(image: ImageInput): Promise<string | undefined> {
    const result = await this.engine.recognize(image.source, {
      language: this.language,
      hash: image.hash,
    });
    return result.fullText.length > 0 ? result.fullText : undefined;
  }
}
