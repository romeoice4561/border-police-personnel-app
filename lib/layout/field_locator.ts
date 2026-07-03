/**
 * FieldLocator
 *
 * Estimates normalized bounding boxes for the fields that AI Vision will
 * later extract (photo, rank, name, position, phone, timeline, biography,
 * header, footer). Coordinates are relative (0-1) fractions of image
 * width/height, so results are resolution-independent.
 *
 * FieldLocator does not read field *values* — it only estimates *where*
 * they likely are, based on the detected template and/or layout features.
 * This narrows the region AI Vision needs to focus on in a later phase.
 */

import type {
  FieldLocations,
  LayoutFeatureSet,
  TemplateDefinition,
  TemplateDetectionResult,
} from "@/lib/layout/layout_types";

/** Contract for a field location backend. Allows swapping in a learned localization model later. */
export interface FieldLocatorEngine {
  locate(
    detection: TemplateDetectionResult,
    features: LayoutFeatureSet,
    template?: TemplateDefinition
  ): Promise<FieldLocations>;
}

/**
 * Template-prior field locator.
 *
 * If a matching TemplateDefinition with `expectedFields` is available, its
 * field regions are returned directly (the template's known layout is the
 * strongest prior). Otherwise, falls back to coarse heuristic defaults
 * derived from the detected category.
 *
 * Future extension point: replace fallback heuristics with a learned
 * per-category localization model, or refine template priors from
 * historical detection accuracy.
 */
export class HeuristicFieldLocator implements FieldLocatorEngine {
  async locate(
    detection: TemplateDetectionResult,
    features: LayoutFeatureSet,
    template?: TemplateDefinition
  ): Promise<FieldLocations> {
    if (template?.expectedFields) {
      return template.expectedFields;
    }

    return this.categoryDefaults(detection, features);
  }

  private categoryDefaults(
    detection: TemplateDetectionResult,
    features: LayoutFeatureSet
  ): FieldLocations {
    const base: FieldLocations = {
      header: { x: 0, y: 0, w: 1, h: 0.12 },
      footer: { x: 0, y: 0.92, w: 1, h: 0.08 },
    };

    switch (detection.category) {
      case "Timeline":
        return {
          ...base,
          photo: { x: 0.05, y: 0.15, w: 0.2, h: 0.3 },
          name: { x: 0.3, y: 0.15, w: 0.5, h: 0.06 },
          rank: { x: 0.3, y: 0.22, w: 0.4, h: 0.05 },
          timeline: {
            x: 0.05,
            y: 0.5,
            w: 0.9,
            h: 0.35,
          },
        };
      case "ProfileCard":
        return {
          ...base,
          photo: { x: 0.12, y: 0.3, w: 0.2, h: 0.42 },
          name: { x: 0.35, y: 0.32, w: 0.5, h: 0.06 },
          rank: { x: 0.35, y: 0.4, w: 0.4, h: 0.05 },
          position: { x: 0.35, y: 0.46, w: 0.4, h: 0.05 },
          phone: { x: 0.35, y: 0.52, w: 0.4, h: 0.05 },
        };
      case "BiographyCard":
        return {
          ...base,
          photo: { x: 0.05, y: 0.15, w: 0.25, h: 0.3 },
          biography: { x: 0.05, y: 0.5, w: 0.9, h: 0.4 },
        };
      case "HistoryCard":
      case "OrganizationCard":
      case "SimpleCard":
      case "MixedLayout":
      case "Unknown":
      default:
        void features;
        return base;
    }
  }
}

/**
 * Estimates field locations for a detected template using the provided
 * engine (defaults to the heuristic locator).
 */
export async function locateFields(
  detection: TemplateDetectionResult,
  features: LayoutFeatureSet,
  template?: TemplateDefinition,
  engine: FieldLocatorEngine = new HeuristicFieldLocator()
): Promise<FieldLocations> {
  return engine.locate(detection, features, template);
}
