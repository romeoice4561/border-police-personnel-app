/**
 * TextFeatureExtractor (Phase 10B).
 *
 * Turns the classifier's signals (OCR text sample + layout features) into a
 * flat list of MatchedFeatures the FeatureScoreEngine sums. Two feature
 * families:
 *   - textual features from feature_dictionary.ts (ranks, police/border-patrol
 *     tokens, phone, timeline/org/title/cover/TOC indicators), matched against
 *     NOISE-NORMALIZED text; and
 *   - structural features derived here (word count, number count, line count,
 *     text density) plus the existing layout portrait signal.
 *
 * Noise tolerance: OCR of Thai cards drops dots, inserts stray spaces, and
 * mixes Thai/Arabic numerals. Before matching, text is (a) run through the
 * existing ThaiNumberConverter (Thai numerals -> Arabic — reused, not
 * duplicated) and (b) whitespace-collapsed, so phone/number patterns and
 * dotted rank abbreviations still fire.
 *
 * Pure: no OCR, no OpenAI, no I/O. Given signals, returns features.
 */

import type { ClassificationSignals } from "@/lib/classifier/classification_types";
import type { MatchedFeature } from "@/lib/classifier/classification_score";
import {
  NEGATIVE_FEATURE_DEFINITIONS,
  TEXT_FEATURE_DEFINITIONS,
  type TextFeatureDefinition,
} from "@/lib/classifier/feature_dictionary";
import { ThaiNumberConverter } from "@/lib/normalize/thai_number_converter";

const thaiNumbers = new ThaiNumberConverter();

/** Collapses runs of whitespace to a single space so OCR spacing noise doesn't break multi-token patterns. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

/**
 * Normalizes OCR text for matching: Thai numerals -> Arabic (reusing the
 * Normalization Engine's converter) and whitespace collapsed. Returns both
 * the collapsed form (for phone/keyword patterns) and the original line
 * split (for structural line counting).
 */
export function normalizeForMatching(text: string): string {
  return collapseWhitespace(thaiNumbers.normalize(text));
}

function countOccurrences(text: string, patterns: RegExp[]): number {
  let total = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) total += matches.length;
  }
  return total;
}

function evaluateTextFeature(def: TextFeatureDefinition, normalized: string): MatchedFeature | undefined {
  const occurrences = countOccurrences(normalized, def.patterns);
  if (occurrences === 0) return undefined;

  const matches = def.onceOnly ? 1 : occurrences;
  return {
    id: def.id,
    category: def.category,
    votesFor: def.votesFor,
    weight: def.weight,
    confidenceImpact: def.confidenceImpact,
    matches,
    reason: `${def.reason} (${occurrences})`,
  };
}

/** Coarse word/number/line counts + a density bucket, used as structural features. */
export interface TextStructure {
  wordCount: number;
  numberCount: number;
  lineCount: number;
}

export function measureTextStructure(rawText: string): TextStructure {
  const normalized = thaiNumbers.normalize(rawText);
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  const numbers = normalized.match(/\d+/g) ?? [];
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return { wordCount: words.length, numberCount: numbers.length, lineCount: lines.length };
}

/**
 * Structural features vote toward PERSONNEL_PROFILE at modest weight: a
 * profile card has a handful of lines with a name, rank, position, and phone
 * (moderate word count, a few numbers), whereas near-empty pages (title/blank)
 * and very dense pages (org charts/tables) are handled by the stronger
 * keyword features above. These give the engine a floor of signal so genuine
 * cards with weak keyword hits still clear UNKNOWN.
 */
function structuralFeatures(structure: TextStructure): MatchedFeature[] {
  const features: MatchedFeature[] = [];

  if (structure.wordCount >= 8 && structure.wordCount <= 400) {
    features.push({
      id: "word_count_moderate",
      category: "word_count",
      votesFor: "PERSONNEL_PROFILE",
      weight: 8,
      confidenceImpact: 4,
      matches: 1,
      reason: `Moderate word count (${structure.wordCount}) consistent with a profile card`,
    });
  }

  if (structure.numberCount >= 1) {
    features.push({
      id: "number_presence",
      category: "number_count",
      votesFor: "PERSONNEL_PROFILE",
      weight: 5,
      confidenceImpact: 3,
      matches: Math.min(structure.numberCount, 5),
      reason: `Contains ${structure.numberCount} numeric token(s) (phone/unit/year)`,
    });
  }

  if (structure.lineCount >= 3 && structure.lineCount <= 60) {
    features.push({
      id: "line_count_card",
      category: "line_count",
      votesFor: "PERSONNEL_PROFILE",
      weight: 6,
      confidenceImpact: 3,
      matches: 1,
      reason: `Line count (${structure.lineCount}) consistent with a profile card`,
    });
  }

  // Very dense text argues toward a table/timeline/org page, away from a card.
  if (structure.lineCount > 60 || structure.wordCount > 400) {
    features.push({
      id: "high_text_density",
      category: "text_density",
      votesFor: "TABLE",
      weight: 15,
      confidenceImpact: 8,
      matches: 1,
      reason: `High text density (${structure.wordCount} words, ${structure.lineCount} lines) suggests a table/dense document`,
    });
  }

  return features;
}

/** The existing layout portrait signal (photo region + timeline orientation) as a strong personnel feature. */
function portraitFeature(signals: ClassificationSignals): MatchedFeature | undefined {
  const hasPortrait = Boolean(signals.features.photoRegion);
  if (!hasPortrait) return undefined;

  const hasCareerHistory = signals.features.timelineOrientation !== "none";
  return {
    id: "portrait_region",
    category: "portrait",
    votesFor: "PERSONNEL_PROFILE",
    weight: hasCareerHistory ? 35 : 20,
    confidenceImpact: hasCareerHistory ? 22 : 12,
    matches: 1,
    reason: hasCareerHistory
      ? "Detected an officer portrait region together with a career/timeline layout signal"
      : "Detected an officer portrait region",
  };
}

/** Contract so the engine can depend on an interface (and tests can inject a fake). */
export interface FeatureExtractor {
  extract(signals: ClassificationSignals): MatchedFeature[];
}

export class TextFeatureExtractor implements FeatureExtractor {
  extract(signals: ClassificationSignals): MatchedFeature[] {
    const features: MatchedFeature[] = [];

    const rawText = signals.textSample ?? "";
    if (rawText.length > 0) {
      const normalized = normalizeForMatching(rawText);

      for (const def of TEXT_FEATURE_DEFINITIONS) {
        const feature = evaluateTextFeature(def, normalized);
        if (feature) features.push(feature);
      }
      for (const def of NEGATIVE_FEATURE_DEFINITIONS) {
        const feature = evaluateTextFeature(def, normalized);
        if (feature) features.push(feature);
      }

      features.push(...structuralFeatures(measureTextStructure(rawText)));
    }

    const portrait = portraitFeature(signals);
    if (portrait) features.push(portrait);

    return features;
  }
}
