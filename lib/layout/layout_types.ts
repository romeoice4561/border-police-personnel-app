/**
 * Shared types for the Layout Intelligence Engine.
 *
 * This module has no runtime dependencies on Supabase, a database, or any
 * UI/API layer. It is pure domain typing for detecting and describing the
 * visual layout of a personnel profile image, prior to AI Vision extraction.
 */

/** Broad layout families a source image can be classified into. */
export type LayoutCategory =
  | "Timeline"
  | "ProfileCard"
  | "SimpleCard"
  | "OrganizationCard"
  | "HistoryCard"
  | "BiographyCard"
  | "MixedLayout"
  | "Unknown";

/** Physical orientation of the source image. */
export type Orientation = "portrait" | "landscape" | "square";

/**
 * Stable identifier for a known template, e.g. "timeline_v3".
 * See docs/TEMPLATE_LIBRARY.md for the naming convention.
 */
export type TemplateId = string;

/**
 * Result of running the TemplateDetector against a single image.
 */
export interface TemplateDetectionResult {
  template_id: TemplateId;
  confidence: number;
  category: LayoutCategory;
  version: string;
  orientation: Orientation;
}

/** A normalized bounding box, all values expressed as fractions (0-1) of image width/height. */
export interface NormalizedRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Named field regions the FieldLocator estimates for a given layout.
 * Any field may be absent if the layout does not include it.
 */
export interface FieldLocations {
  photo?: NormalizedRegion;
  rank?: NormalizedRegion;
  name?: NormalizedRegion;
  position?: NormalizedRegion;
  phone?: NormalizedRegion;
  timeline?: NormalizedRegion;
  biography?: NormalizedRegion;
  header?: NormalizedRegion;
  footer?: NormalizedRegion;
}

/** Coarse text density bucket for a region or the image as a whole. */
export type TextDensity = "none" | "sparse" | "moderate" | "dense";

/** Orientation of a detected timeline element, if any. */
export type TimelineOrientation = "horizontal" | "vertical" | "none";

/** Coarse visual background classification. */
export type BackgroundStyle = "plain" | "textured" | "branded" | "photographic" | "unknown";

/**
 * Extracted visual features used as input to classification and detection.
 * Represents *descriptive* signals about the image, not extracted personnel
 * data.
 */
export interface LayoutFeatureSet {
  /** Normalized vertical position of the header band, if detected. */
  headerPosition?: NormalizedRegion;
  /** Normalized size/position of the dominant photo region, if detected. */
  photoRegion?: NormalizedRegion;
  /** Overall text density of the image. */
  textDensity: TextDensity;
  /** Orientation of the timeline element, if present. */
  timelineOrientation: TimelineOrientation;
  /** Coarse background style classification. */
  backgroundStyle: BackgroundStyle;
  /** Regions of the image with the highest visual/informational density, ranked. */
  dominantRegions: NormalizedRegion[];
  /** Physical image orientation. */
  orientation: Orientation;
}

/** Input passed into layout engine modules. Represents an image reference, not pixel data. */
export interface ImageInput {
  /** Path, URL, or storage key identifying the source image. */
  source: string;
  /** Optional pre-computed hash, e.g. for cache lookups. Computed if omitted. */
  hash?: string;
  /** Optional known width/height in pixels, if already available. */
  width?: number;
  height?: number;
}

/** A single classification candidate with its confidence, before the top result is selected. */
export interface ClassificationCandidate {
  category: LayoutCategory;
  confidence: number;
}

/** Full output of the LayoutClassifier, including the runner-up candidates for transparency. */
export interface ClassificationResult {
  best: ClassificationCandidate;
  candidates: ClassificationCandidate[];
}

/** Metadata describing a known template registered in the LayoutRegistry. */
export interface TemplateDefinition {
  template_id: TemplateId;
  category: LayoutCategory;
  version: string;
  /** Alternative identifiers historically used for this template. */
  aliases: string[];
  /** Expected field layout for this template, used as a detection prior. */
  expectedFields?: FieldLocations;
  /** Number of times this template has been detected. */
  usageCount: number;
  /** ISO timestamp of the most recent detection, if any. */
  lastDetectedAt?: string;
}

/** Cache entry pairing an image hash with a previously computed detection result. */
export interface TemplateCacheEntry {
  hash: string;
  result: TemplateDetectionResult;
  cachedAt: string;
}

/** Outcome of a cache lookup. */
export interface CacheLookupResult {
  hit: boolean;
  entry?: TemplateCacheEntry;
}
