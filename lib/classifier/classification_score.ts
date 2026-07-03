/**
 * Classification scoring types (Phase 10B).
 *
 * The weighted-feature-scoring replacement for the Phase 8.5 first-match
 * keyword rules. A `FeatureScoreEngine` extracts many small text/layout
 * *features* from the classification signals, each carrying a weight, a
 * target category, and a confidence impact; the engine sums them per
 * category, picks the winning category, and reports the score, confidence,
 * human-readable reasons, and the top matched features.
 *
 * Pure domain typing only — no OCR, no OpenAI, no I/O. The extraction and
 * engine live in text_feature_extractor.ts / feature_score_engine.ts.
 */

import type { ImageCategory } from "@/lib/classifier/classification_types";

/**
 * The kind of signal a feature represents. Used for reporting/statistics
 * ("top matched feature kinds") and to group the dictionary.
 */
export type FeatureCategory =
  | "rank"
  | "police_abbreviation"
  | "border_patrol"
  | "phone"
  | "timeline"
  | "organization"
  | "title"
  | "cover"
  | "toc"
  | "text_density"
  | "word_count"
  | "number_count"
  | "line_count"
  | "portrait";

/**
 * A single detected feature contributing to the score. `weight` is added to
 * (or subtracted from, when negative) the target category's running score;
 * `confidenceImpact` adjusts the winning category's confidence. `matches`
 * records how many times the underlying signal fired (for reporting).
 */
export interface MatchedFeature {
  /** Stable id, e.g. "rank_police_officer" or "org_chart_keyword". */
  id: string;
  category: FeatureCategory;
  /** Category this feature votes for. */
  votesFor: ImageCategory;
  /** Score contribution — positive pushes toward `votesFor`, negative pushes away. */
  weight: number;
  /** Adjustment applied to the final confidence when this feature is among the winners. */
  confidenceImpact: number;
  /** Number of underlying occurrences that triggered this feature. */
  matches: number;
  /** Short human-readable explanation, e.g. 'Detected officer rank "พ.ต.ท."'. */
  reason: string;
}

/** Per-category running total, used to pick the winner and report the spread. */
export interface CategoryScore {
  category: ImageCategory;
  score: number;
}

/**
 * Full output of scoring one image: the winning category and its confidence,
 * every category's score (for transparency/statistics), the reasons behind
 * the decision, and the top matched features ranked by contribution.
 */
export interface ClassificationScore {
  category: ImageCategory;
  /** 0-100. */
  confidence: number;
  /** Winning category's raw summed score. */
  score: number;
  /** All category scores, highest first. */
  categoryScores: CategoryScore[];
  /** Human-readable decision reasons, most significant first. */
  reasons: string[];
  /** Features that contributed most to the decision, ranked by absolute weight × matches. */
  topFeatures: MatchedFeature[];
}
