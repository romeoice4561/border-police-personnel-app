/**
 * ClassificationEngine
 *
 * Evaluates a set of injected ClassificationRules in priority order and
 * returns the first matching result. If no rule matches, or the matching
 * rule's confidence is below MIN_CLASSIFICATION_CONFIDENCE (60), the image
 * is classified as UNKNOWN with shouldProcess = false — never guessed into
 * PERSONNEL_PROFILE.
 *
 * Pure and interface-first: this class has a single responsibility
 * (ordering + confidence-floor enforcement); the actual classification
 * logic lives entirely in the injected rules (SOLID).
 */

import type {
  ClassificationRule,
  ClassificationSignals,
  ImageClassificationEngine as ImageClassificationEngineContract,
  ImageClassificationResult,
} from "@/lib/classifier/classification_types";
import { MIN_CLASSIFICATION_CONFIDENCE } from "@/lib/classifier/classification_types";
import { createDefaultClassificationRules } from "@/lib/classifier/classification_rules";

const UNKNOWN_RESULT: ImageClassificationResult = {
  category: "UNKNOWN",
  confidence: 0,
  reason: "No classification rule matched this image with sufficient confidence.",
  shouldProcess: false,
};

export interface ClassificationEngineDependencies {
  rules?: ClassificationRule[];
}

export class ClassificationEngine implements ImageClassificationEngineContract {
  private readonly rules: ClassificationRule[];

  constructor(dependencies: ClassificationEngineDependencies = {}) {
    this.rules = dependencies.rules ?? createDefaultClassificationRules();
  }

  classify(signals: ClassificationSignals): ImageClassificationResult {
    for (const rule of this.rules) {
      const result = rule.evaluate(signals);
      if (!result) continue;

      if (result.confidence < MIN_CLASSIFICATION_CONFIDENCE) {
        return {
          ...UNKNOWN_RESULT,
          reason: `Rule matched category "${result.category}" but confidence (${result.confidence}) was below the minimum threshold (${MIN_CLASSIFICATION_CONFIDENCE}).`,
        };
      }

      return result;
    }

    return UNKNOWN_RESULT;
  }
}
