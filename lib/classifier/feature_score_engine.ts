/**
 * FeatureScoreEngine (Phase 10B).
 *
 * The weighted-feature-scoring replacement for the Phase 8.5 first-match
 * keyword ClassificationEngine. Implements the SAME `ImageClassificationEngine`
 * contract, so it drops into ImageClassifier's existing `engine` seam with no
 * change to the classifier, OCR, OpenAI, or any downstream stage — only the
 * decision logic changes.
 *
 * Algorithm:
 *   1. Extract every MatchedFeature (TextFeatureExtractor) — ranks, police/
 *      border-patrol tokens, phone, timeline/org/title/cover/TOC indicators,
 *      structural counts, portrait signal.
 *   2. Sum weight × matches per voted category (features may vote negative,
 *      e.g. org/cover keywords subtract from PERSONNEL_PROFILE).
 *   3. Add the Layout Detector's own category as a weak prior so a
 *      text-poor page still has a signal.
 *   4. Pick the highest-scoring category. Confidence is derived from the
 *      winner's cumulative confidence impact, bounded 0-100 and scaled by how
 *      decisively it beat the runner-up.
 *   5. Only PERSONNEL_PROFILE yields shouldProcess = true (unchanged rule).
 *
 * A category only "wins" if its score clears a low floor; otherwise UNKNOWN.
 * The floor is deliberately low because the scoring model accumulates many
 * weak-but-real signals, keeping UNKNOWN rare on genuine documents.
 *
 * Pure and injectable: the feature extractor and tuning are injected; no
 * singleton, no globals.
 */

import type {
  ClassificationSignals,
  ImageCategory,
  ImageClassificationEngine,
  ImageClassificationResult,
} from "@/lib/classifier/classification_types";
import type {
  CategoryScore,
  ClassificationScore,
  FeatureCategory,
  MatchedFeature,
} from "@/lib/classifier/classification_score";
import { TextFeatureExtractor, type FeatureExtractor } from "@/lib/classifier/text_feature_extractor";
import type { LayoutCategory } from "@/lib/layout/layout_types";

/**
 * Purely structural feature kinds (counts/density). They REINFORCE a category
 * but must never, on their own, be enough to commit to one — otherwise any
 * text-bearing page (even OCR garbage with enough tokens) would score into a
 * category. A category can only win if at least one non-structural (domain)
 * feature also voted for it.
 */
const STRUCTURAL_FEATURE_KINDS: ReadonlySet<FeatureCategory> = new Set<FeatureCategory>([
  "text_density",
  "word_count",
  "number_count",
  "line_count",
]);

/** Minimum winning score required to commit to a category; below this -> UNKNOWN. */
const DEFAULT_MIN_SCORE = 12;
/** Weak prior weight given to the Layout Detector's own category. */
const LAYOUT_PRIOR_WEIGHT = 10;

const PROCESSABLE: ImageCategory = "PERSONNEL_PROFILE";

export interface FeatureScoreEngineConfig {
  featureExtractor?: FeatureExtractor;
  /** Score floor below which the result is UNKNOWN. */
  minScore?: number;
  /**
   * Optional observer invoked with the full ClassificationScore each time
   * classify() runs. Lets a runner collect statistics (top matched features,
   * average confidence, category distribution) without re-scoring or changing
   * the classifier's return type. No-op by default.
   */
  onScored?: (score: ClassificationScore) => void;
}

/** Maps a LayoutCategory (Layout Detector output) to the classifier's ImageCategory for the weak prior. */
function layoutCategoryToImageCategory(category: LayoutCategory): ImageCategory | undefined {
  switch (category) {
    case "ProfileCard":
    case "BiographyCard":
      return "PERSONNEL_PROFILE";
    case "Timeline":
    case "HistoryCard":
      return "TIMELINE";
    case "OrganizationCard":
      return "ORGANIZATION_CHART";
    default:
      return undefined;
  }
}

export class FeatureScoreEngine implements ImageClassificationEngine {
  private readonly featureExtractor: FeatureExtractor;
  private readonly minScore: number;
  private readonly onScored?: (score: ClassificationScore) => void;

  constructor(config: FeatureScoreEngineConfig = {}) {
    this.featureExtractor = config.featureExtractor ?? new TextFeatureExtractor();
    this.minScore = config.minScore ?? DEFAULT_MIN_SCORE;
    this.onScored = config.onScored;
  }

  /** Full transparent scoring output — the classifier uses the reduced ImageClassificationResult below. */
  score(signals: ClassificationSignals): ClassificationScore {
    const features = this.featureExtractor.extract(signals);

    const scores = new Map<ImageCategory, number>();
    const confidenceByCategory = new Map<ImageCategory, number>();
    /** Categories that received at least one positive non-structural (domain) vote. */
    const domainSupported = new Set<ImageCategory>();

    for (const feature of features) {
      const contribution = feature.weight * feature.matches;
      scores.set(feature.votesFor, (scores.get(feature.votesFor) ?? 0) + contribution);
      if (feature.weight > 0) {
        confidenceByCategory.set(
          feature.votesFor,
          (confidenceByCategory.get(feature.votesFor) ?? 0) + feature.confidenceImpact * feature.matches
        );
        if (!STRUCTURAL_FEATURE_KINDS.has(feature.category)) {
          domainSupported.add(feature.votesFor);
        }
      }
    }

    // Weak layout prior. The Layout Detector's own category is a legitimate
    // (non-structural) signal, so it also confers domain support.
    const layoutCategory = layoutCategoryToImageCategory(signals.detection.category);
    if (layoutCategory) {
      scores.set(layoutCategory, (scores.get(layoutCategory) ?? 0) + LAYOUT_PRIOR_WEIGHT);
      confidenceByCategory.set(
        layoutCategory,
        (confidenceByCategory.get(layoutCategory) ?? 0) + Math.round(signals.detection.confidence * 0.1)
      );
      domainSupported.add(layoutCategory);
    }

    // Only categories with real domain support may win; structural counts
    // alone (word/number/line/density) are never sufficient.
    const categoryScores: CategoryScore[] = Array.from(scores.entries())
      .filter(([category]) => domainSupported.has(category))
      .map(([category, score]) => ({ category, score }))
      .sort((a, b) => b.score - a.score);

    const winner = categoryScores[0];
    const runnerUp = categoryScores[1];

    if (!winner || winner.score < this.minScore) {
      return {
        category: "UNKNOWN",
        confidence: 0,
        score: winner?.score ?? 0,
        categoryScores,
        reasons: ["No category accumulated enough weighted evidence to classify confidently."],
        topFeatures: this.rankFeatures(features),
      };
    }

    const confidence = this.computeConfidence(
      confidenceByCategory.get(winner.category) ?? 0,
      winner.score,
      runnerUp?.score ?? 0
    );

    const winningFeatures = features
      .filter((feature) => feature.votesFor === winner.category && feature.weight > 0)
      .sort((a, b) => Math.abs(b.weight * b.matches) - Math.abs(a.weight * a.matches));

    return {
      category: winner.category,
      confidence,
      score: winner.score,
      categoryScores,
      reasons: winningFeatures.slice(0, 5).map((feature) => feature.reason),
      topFeatures: this.rankFeatures(features),
    };
  }

  classify(signals: ClassificationSignals): ImageClassificationResult {
    const scored = this.score(signals);
    this.onScored?.(scored);

    return {
      category: scored.category,
      confidence: scored.confidence,
      reason:
        scored.reasons.length > 0
          ? scored.reasons.join("; ")
          : "No weighted evidence matched.",
      shouldProcess: scored.category === PROCESSABLE,
    };
  }

  /**
   * Confidence in 0-100: the winner's cumulative confidence impact, capped at
   * 100, then scaled up when it clearly beat the runner-up (a dominant margin
   * reads as higher confidence, a near-tie as lower).
   */
  private computeConfidence(cumulativeImpact: number, winnerScore: number, runnerUpScore: number): number {
    const base = Math.min(100, cumulativeImpact);
    const margin = winnerScore <= 0 ? 0 : (winnerScore - Math.max(0, runnerUpScore)) / winnerScore;
    // Blend: mostly the accumulated impact, nudged by decisiveness of the win.
    const blended = base * (0.8 + 0.2 * Math.max(0, Math.min(1, margin)));
    return Math.max(0, Math.min(100, Math.round(blended)));
  }

  /** Top matched features overall, ranked by absolute contribution (for reasons/statistics). */
  private rankFeatures(features: MatchedFeature[]): MatchedFeature[] {
    return [...features]
      .sort((a, b) => Math.abs(b.weight * b.matches) - Math.abs(a.weight * a.matches))
      .slice(0, 8);
  }
}
