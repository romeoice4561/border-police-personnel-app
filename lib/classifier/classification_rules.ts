/**
 * ClassificationRule implementations.
 *
 * Each rule is a small, pure, single-responsibility check (SOLID) over
 * `ClassificationSignals` — never over filename, folder name, or image
 * path (per docs/IMAGE_CLASSIFICATION_ENGINE.md, "Classification Rules").
 * `ClassificationEngine` (classification_engine.ts) evaluates rules in
 * priority order and takes the first match; rules are independently
 * testable and reorderable without touching the engine.
 *
 * Text-keyword rules operate on `signals.textSample`, an optional
 * lightweight text source (never OpenAI Vision output — see
 * `classification_types.ts`). When no text sample is available, only the
 * layout/feature-based rules can fire.
 */

import type {
  ClassificationRule,
  ClassificationSignals,
  ImageClassificationResult,
} from "@/lib/classifier/classification_types";

function contains(text: string | undefined, keyword: string): boolean {
  return typeof text === "string" && text.includes(keyword);
}

/** "Timeline รับราชการ" (career timeline) strongly indicates a personnel profile document. */
export class TimelineKeywordRule implements ClassificationRule {
  evaluate(signals: ClassificationSignals): ImageClassificationResult | undefined {
    if (!contains(signals.textSample, "Timeline รับราชการ")) return undefined;

    return {
      category: "PERSONNEL_PROFILE",
      confidence: 92,
      reason: 'Text sample contains "Timeline รับราชการ", indicating a personnel career timeline.',
      shouldProcess: true,
    };
  }
}

/** "สารบัญ" (table of contents) indicates an index page, never a personnel record. */
export class IndexPageKeywordRule implements ClassificationRule {
  evaluate(signals: ClassificationSignals): ImageClassificationResult | undefined {
    if (!contains(signals.textSample, "สารบัญ")) return undefined;

    return {
      category: "INDEX_PAGE",
      confidence: 90,
      reason: 'Text sample contains "สารบัญ" (table of contents), indicating an index page.',
      shouldProcess: false,
    };
  }
}

/** "ระดับ บก." / "ระดับ กก." / "ผัง" all indicate an organizational chart, not an individual profile. */
export class OrganizationChartKeywordRule implements ClassificationRule {
  private static readonly KEYWORDS = ["ระดับ บก.", "ระดับ กก.", "ผัง"];

  evaluate(signals: ClassificationSignals): ImageClassificationResult | undefined {
    const matched = OrganizationChartKeywordRule.KEYWORDS.find((keyword) => contains(signals.textSample, keyword));
    if (!matched) return undefined;

    return {
      category: "ORGANIZATION_CHART",
      confidence: 88,
      reason: `Text sample contains "${matched}", indicating an organization chart.`,
      shouldProcess: false,
    };
  }
}

/** "คำนำ" (foreword/preface) indicates a document cover page. */
export class CoverPageKeywordRule implements ClassificationRule {
  evaluate(signals: ClassificationSignals): ImageClassificationResult | undefined {
    if (!contains(signals.textSample, "คำนำ")) return undefined;

    return {
      category: "COVER_PAGE",
      confidence: 88,
      reason: 'Text sample contains "คำนำ" (foreword), indicating a cover page.',
      shouldProcess: false,
    };
  }
}

/** "เฉพาะตราหน่วย" (unit emblem only) indicates a title page bearing just an emblem/insignia, no personnel data. */
export class TitlePageKeywordRule implements ClassificationRule {
  evaluate(signals: ClassificationSignals): ImageClassificationResult | undefined {
    if (!contains(signals.textSample, "เฉพาะตราหน่วย")) return undefined;

    return {
      category: "TITLE_PAGE",
      confidence: 85,
      reason: 'Text sample contains "เฉพาะตราหน่วย" (unit emblem only), indicating a title page.',
      shouldProcess: false,
    };
  }
}

/**
 * Officer portrait (a detected photo region) combined with a career
 * history signal (non-empty timeline entries or timeline orientation) is
 * the strongest layout-only signal of a personnel profile, independent of
 * any text sample.
 */
export class PortraitWithCareerHistoryRule implements ClassificationRule {
  evaluate(signals: ClassificationSignals): ImageClassificationResult | undefined {
    const hasPortrait = Boolean(signals.features.photoRegion);
    const hasCareerHistory = signals.features.timelineOrientation !== "none";

    if (!hasPortrait || !hasCareerHistory) return undefined;

    return {
      category: "PERSONNEL_PROFILE",
      confidence: 82,
      reason: "Detected an officer portrait region together with a career/timeline layout signal.",
      shouldProcess: true,
    };
  }
}

/** Falls back to the Layout Detector's own category when no text-keyword or portrait+history rule matched. */
export class LayoutDetectionFallbackRule implements ClassificationRule {
  evaluate(signals: ClassificationSignals): ImageClassificationResult | undefined {
    const { category, confidence } = signals.detection;

    switch (category) {
      case "Timeline":
        return {
          category: "TIMELINE",
          confidence,
          reason: "Layout Detector classified this image as a Timeline layout.",
          shouldProcess: false,
        };
      case "ProfileCard":
      case "BiographyCard":
        return {
          category: "PERSONNEL_PROFILE",
          confidence,
          reason: `Layout Detector classified this image as a ${signals.detection.category} layout.`,
          shouldProcess: true,
        };
      case "OrganizationCard":
        return {
          category: "ORGANIZATION_CHART",
          confidence,
          reason: "Layout Detector classified this image as an OrganizationCard layout.",
          shouldProcess: false,
        };
      case "HistoryCard":
        return {
          category: "TIMELINE",
          confidence,
          reason: "Layout Detector classified this image as a HistoryCard layout.",
          shouldProcess: false,
        };
      default:
        return undefined;
    }
  }
}

/** Default set of rules, evaluated in priority order by ClassificationEngine. */
export function createDefaultClassificationRules(): ClassificationRule[] {
  return [
    new TimelineKeywordRule(),
    new IndexPageKeywordRule(),
    new OrganizationChartKeywordRule(),
    new CoverPageKeywordRule(),
    new TitlePageKeywordRule(),
    new PortraitWithCareerHistoryRule(),
    new LayoutDetectionFallbackRule(),
  ];
}
