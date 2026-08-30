/**
 * Analyst annotation data model (Phase DI-9.4).
 *
 * Annotations are PRESENTATION STATE ONLY — the data objects live in xyflow
 * node `data.annotation` (inside the page's `flowNodes` state), never written
 * to any API, never persisted (a refresh clears them — DI-9.5 will add
 * board persistence). Annotations MUST NOT:
 *   - create DrugRelationship
 *   - alter edgeKind / evidence / source / target
 *   - enter BFS / neighborhood / Find Connection logic
 *   - count as factual graph nodes or edges
 *   - appear in factual search results
 *
 * No React / @xyflow/react import — pure data in, data out, so this is
 * testable without a DOM or provider, matching the existing convention in
 * drug_network_graph_layout.ts, drug_network_graph_pinning.ts, and
 * drug_network_edge_routing.ts.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrugNetworkAnnotationType = "RECTANGLE" | "ELLIPSE" | "TEXT" | "LINE" | "ARROW" | "IMAGE";

/**
 * Active drawing tool in Analyst Mode.
 * SELECT / PAN are navigation tools; the rest are creation tools.
 * State is client-only UI presentation — never persisted, never written to any
 * API, never included in URL params or graph query signature.
 */
export type DrugNetworkAnalystTool =
  | "SELECT"
  | "PAN"
  | "LINE"
  | "ARROW"
  | "RECTANGLE"
  | "ELLIPSE"
  | "TEXT"
  | "IMAGE";

/**
 * Core annotation data object. Position and size live in the xyflow `FlowNode`
 * that embeds this annotation (in `flowNode.position` and `flowNode.width/
 * height`) — xyflow manages those authoritative values so user drags and
 * NodeResizer resize events are handled automatically without any manual sync
 * loop. This interface carries only the STYLE / CONTENT properties that xyflow
 * does not itself own.
 *
 * For LINE and ARROW, `endOffset` is the vector from the node's xyflow
 * `position` (= start point) to the end point (graph-space pixels).
 */
export type DrugNetworkAnnotationStrokeDash = "solid" | "dashed" | "dotted";

export interface DrugNetworkAnnotation {
  id: string;
  type: DrugNetworkAnnotationType;
  /** Stroke / text color. */
  color: string;
  /** Fill / background color for RECTANGLE and ELLIPSE shapes. "transparent" = no fill. */
  fillColor: string;
  /** Stroke width in pixels (0 for TEXT). */
  strokeWidth: number;
  /** Stroke dash style for lines, arrows, and shape borders. */
  strokeDash?: DrugNetworkAnnotationStrokeDash;
  /** Text content for TEXT annotations. */
  text?: string;
  /** Font size in pixels for TEXT annotations. */
  fontSize?: number;
  /** For LINE / ARROW: vector from start to end in graph-space pixels. */
  endOffset?: { x: number; y: number };
  /**
   * Object URL for IMAGE annotations (session-local only — revoke via
   * URL.revokeObjectURL when the annotation is deleted or the component
   * unmounts).
   */
  imageSrc?: string;
  /** Caption for IMAGE annotations, shown below the image. */
  caption?: string;
}

// ─── Style constants ──────────────────────────────────────────────────────────

export const ANNOTATION_DEFAULT_COLORS = [
  "#000000", "#666666", "#ffffff",
  "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
] as const;

export const ANNOTATION_DEFAULT_FILL_COLORS = [
  "transparent",
  "#fef2f2", "#fff7ed", "#fefce8",
  "#f0fdf4", "#eff6ff", "#faf5ff", "#fdf2f8",
] as const;

export const ANNOTATION_STROKE_WIDTHS = [1, 2, 4, 6] as const;
export const ANNOTATION_DEFAULT_FONT_SIZES = [12, 14, 16, 20, 24] as const;
export const ANNOTATION_STROKE_DASHES: DrugNetworkAnnotationStrokeDash[] = ["solid", "dashed", "dotted"];

export const ANNOTATION_DEFAULTS: Pick<DrugNetworkAnnotation, "color" | "fillColor" | "strokeWidth" | "fontSize" | "strokeDash"> = {
  color: "#3b82f6",
  fillColor: "transparent",
  strokeWidth: 2,
  fontSize: 14,
  strokeDash: "solid",
};

// ─── Default sizes used when placing a new annotation ─────────────────────────

export const ANNOTATION_DEFAULT_SIZES: Record<Exclude<DrugNetworkAnnotationType, "LINE" | "ARROW">, { width: number; height: number }> = {
  RECTANGLE: { width: 200, height: 120 },
  ELLIPSE:   { width: 160, height: 100 },
  TEXT:      { width: 180, height:  60 },
  IMAGE:     { width: 200, height: 150 },
};

// ─── ID generation ────────────────────────────────────────────────────────────

let _annotationIdCounter = 0;
/**
 * Returns a unique annotation id for the current browser session.
 * Ids never leave the tab or get persisted, so crypto/uuid is not needed;
 * a simple counter + timestamp is sufficient and avoids a new import.
 * Starts with "ann-" so callers can identify annotation flow nodes by id prefix.
 */
export function nextAnnotationId(): string {
  _annotationIdCounter += 1;
  return `ann-${Date.now().toString(36)}-${_annotationIdCounter}`;
}

/** Returns true when the given node id belongs to an annotation (not a factual graph node). */
export function isAnnotationId(id: string): boolean {
  return id.startsWith("ann-");
}

// ─── Annotation factory helpers ───────────────────────────────────────────────

/** Builds a new RECTANGLE annotation with the given defaults. */
export function createRectangleAnnotation(defaults = ANNOTATION_DEFAULTS): DrugNetworkAnnotation {
  return { id: nextAnnotationId(), type: "RECTANGLE", color: defaults.color, fillColor: defaults.fillColor, strokeWidth: defaults.strokeWidth, strokeDash: defaults.strokeDash };
}

/** Builds a new ELLIPSE annotation. */
export function createEllipseAnnotation(defaults = ANNOTATION_DEFAULTS): DrugNetworkAnnotation {
  return { id: nextAnnotationId(), type: "ELLIPSE", color: defaults.color, fillColor: defaults.fillColor, strokeWidth: defaults.strokeWidth, strokeDash: defaults.strokeDash };
}

/** Builds a new TEXT annotation. */
export function createTextAnnotation(defaults = ANNOTATION_DEFAULTS): DrugNetworkAnnotation {
  return { id: nextAnnotationId(), type: "TEXT", color: defaults.color, fillColor: "transparent", strokeWidth: 0, text: "", fontSize: defaults.fontSize };
}

/** Builds a new LINE annotation. `endOffset` is the vector from start to end. */
export function createLineAnnotation(endOffset: { x: number; y: number }, defaults = ANNOTATION_DEFAULTS): DrugNetworkAnnotation {
  return { id: nextAnnotationId(), type: "LINE", color: defaults.color, fillColor: "transparent", strokeWidth: defaults.strokeWidth, strokeDash: defaults.strokeDash, endOffset };
}

/** Builds a new ARROW annotation. */
export function createArrowAnnotation(endOffset: { x: number; y: number }, defaults = ANNOTATION_DEFAULTS): DrugNetworkAnnotation {
  return { id: nextAnnotationId(), type: "ARROW", color: defaults.color, fillColor: "transparent", strokeWidth: defaults.strokeWidth, strokeDash: defaults.strokeDash, endOffset };
}

/**
 * Computes the SVG bounding box dimensions for a LINE/ARROW annotation.
 * Used when building/updating flow nodes so the node rect exactly fits the line.
 */
export function lineAnnotationNodeDimensions(endOffset: { x: number; y: number }, strokeWidth: number): { width: number; height: number } {
  const pad = Math.max(strokeWidth * 2, 12);
  return {
    width: Math.max(1, Math.abs(endOffset.x)) + pad * 2,
    height: Math.max(1, Math.abs(endOffset.y)) + pad * 2,
  };
}

/**
 * Returns a CSS strokeDasharray string for an annotation's strokeDash value.
 * Used in SVG rendering for lines, arrows, and shape borders.
 */
export function strokeDashArray(dash: DrugNetworkAnnotationStrokeDash | undefined, strokeWidth: number): string | undefined {
  const w = Math.max(1, strokeWidth);
  switch (dash) {
    case "dashed": return `${w * 4} ${w * 2}`;
    case "dotted": return `${w} ${w * 2}`;
    default: return undefined;
  }
}

/**
 * Builds a new IMAGE annotation. `imageSrc` must be a valid object URL or data URL.
 * Callers are responsible for revoking object URLs when the annotation is deleted
 * (use retainBlobUrl / releaseBlobUrl when the same URL may be shared by duplicates).
 */
export function createImageAnnotation(imageSrc: string): DrugNetworkAnnotation {
  return { id: nextAnnotationId(), type: "IMAGE", imageSrc, caption: "", color: "#000000", fillColor: "transparent", strokeWidth: 1 };
}

// ─── IMAGE insertion helpers (DI-9.4.1 Human QA fix) ─────────────────────────

/** MIME types accepted by the Image tool file picker. */
export const IMAGE_ANNOTATION_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/** Max upload size for a session-local image annotation (10 MB). */
export const IMAGE_ANNOTATION_MAX_BYTES = 10 * 1024 * 1024;

/** Max initial bounding box when placing a newly inserted image. */
export const IMAGE_ANNOTATION_MAX_INITIAL = { width: 320, height: 240 } as const;

export type ImageAnnotationValidationResult =
  | { ok: true }
  | { ok: false; reason: "mime" | "size" };

/** Validates MIME + size for Image tool file selection. Pure — no DOM. */
export function validateImageAnnotationFile(file: {
  type: string;
  size: number;
}): ImageAnnotationValidationResult {
  if (!(IMAGE_ANNOTATION_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "mime" };
  }
  if (file.size > IMAGE_ANNOTATION_MAX_BYTES) {
    return { ok: false, reason: "size" };
  }
  return { ok: true };
}

/**
 * Fits natural image dimensions into maxW×maxH while preserving aspect ratio.
 * Never stretches; portrait stays portrait, landscape stays landscape.
 */
export function computeImageAnnotationInitialSize(
  naturalWidth: number,
  naturalHeight: number,
  maxW: number = IMAGE_ANNOTATION_MAX_INITIAL.width,
  maxH: number = IMAGE_ANNOTATION_MAX_INITIAL.height
): { width: number; height: number } {
  const w = Math.max(1, naturalWidth);
  const h = Math.max(1, naturalHeight);
  const scale = Math.min(1, maxW / w, maxH / h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/**
 * Reference-counted blob URL registry.
 * Duplicating an IMAGE annotation shares the same object URL; revoke only when
 * the last annotation using that URL is removed.
 */
export function retainBlobUrl(
  registry: Map<string, number>,
  url: string | undefined | null
): void {
  if (!url || !url.startsWith("blob:")) return;
  registry.set(url, (registry.get(url) ?? 0) + 1);
}

export function releaseBlobUrl(
  registry: Map<string, number>,
  url: string | undefined | null,
  revoke: (u: string) => void = (u) => URL.revokeObjectURL(u)
): void {
  if (!url || !url.startsWith("blob:")) return;
  const next = (registry.get(url) ?? 1) - 1;
  if (next <= 0) {
    registry.delete(url);
    revoke(url);
  } else {
    registry.set(url, next);
  }
}

export function blobUrlRefCount(registry: Map<string, number>, url: string): number {
  return registry.get(url) ?? 0;
}

/**
 * Top-left graph-space position that centers a sized object on a viewport center.
 */
export function imageAnnotationCenteredPosition(
  viewportCenter: { x: number; y: number },
  size: { width: number; height: number }
): { x: number; y: number } {
  return {
    x: viewportCenter.x - size.width / 2,
    y: viewportCenter.y - size.height / 2,
  };
}

// ─── Mutation helpers (pure — never mutate the input array) ──────────────────

/** Updates one annotation in an array by id. Returns the original reference when the id is not found. */
export function updateAnnotation(annotations: DrugNetworkAnnotation[], id: string, patch: Partial<DrugNetworkAnnotation>): DrugNetworkAnnotation[] {
  const idx = annotations.findIndex((a) => a.id === id);
  if (idx < 0) return annotations;
  const next = [...annotations];
  next[idx] = { ...next[idx], ...patch };
  return next;
}

/** Removes an annotation by id. Returns the original reference when the id is not found. */
export function removeAnnotation(annotations: DrugNetworkAnnotation[], id: string): DrugNetworkAnnotation[] {
  const result = annotations.filter((a) => a.id !== id);
  return result.length === annotations.length ? annotations : result;
}

/** Duplicates an annotation with a slight position offset (caller merges id → flowNode separately). */
export function buildDuplicateAnnotation(ann: DrugNetworkAnnotation): DrugNetworkAnnotation {
  return { ...ann, id: nextAnnotationId() };
}

// ─── Classification helpers ──────────────────────────────────────────────────

/** True when the annotation is a filled/stroked shape (RECTANGLE or ELLIPSE). */
export function isShapeAnnotation(type: DrugNetworkAnnotationType): boolean {
  return type === "RECTANGLE" || type === "ELLIPSE";
}

/** True when the annotation is a line or arrow (two endpoints, no fill). */
export function isLineAnnotation(type: DrugNetworkAnnotationType): boolean {
  return type === "LINE" || type === "ARROW";
}

/**
 * Returns the xyflow node `type` string for a given annotation type.
 * "annotationShape" handles RECTANGLE, ELLIPSE, TEXT, IMAGE.
 * "annotationLine"  handles LINE and ARROW.
 * Neither string overlaps with "drugGraphNode" or any factual edge type.
 */
export function annotationFlowNodeType(type: DrugNetworkAnnotationType): "annotationShape" | "annotationLine" {
  return isLineAnnotation(type) ? "annotationLine" : "annotationShape";
}
