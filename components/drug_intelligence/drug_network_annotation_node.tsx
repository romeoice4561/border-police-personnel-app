/**
 * Custom @xyflow/react node renderers for analyst annotations (Phase DI-9.4).
 *
 * Two node types are registered in the page's nodeTypes map:
 *   "annotationShape" — RECTANGLE, ELLIPSE, TEXT, IMAGE
 *   "annotationLine"  — LINE, ARROW
 *
 * CRITICAL architecture (DI-9.4 Section 0):
 * - These nodes are PRESENTATION ONLY. They carry no DrugGraphNode, no
 *   DrugGraphEdge, no relationship evidence, no edgeKind.
 * - NodeResizer is used for SHAPE annotations ONLY — never applied to
 *   factual "drugGraphNode" nodes (factual nodes are non-resizable by design).
 * - Annotation nodes are visually distinct from factual nodes: dashed border,
 *   annotation badge on selection, no entity-type icon, no risk indicators.
 * - LINE/ARROW nodes render as SVG inside their bounding box. They look
 *   clearly different from factual relationship edges (different color scheme,
 *   dashed appearance when selected, no DIRECT/INFERRED evidence badge).
 *
 * Selection (Section 6): annotation selection is distinguished from factual
 * node/edge selection in the page handler — annotation clicks set
 * `selectedAnnotationId` while clearing `selectedNode` / `selectedEdge`.
 *
 * Board Lock (Section 36): when `boardLocked` is true, annotations are not
 * draggable (set in the flow-node `draggable` field) and NodeResizer is not
 * shown. Selection and inspection still work.
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/ui/cn";
import type { DrugNetworkAnnotation } from "@/lib/drug_intelligence/drug_network_annotations";

// ─── Data interface ────────────────────────────────────────────────────────────

export interface DrugNetworkAnnotationNodeData extends Record<string, unknown> {
  annotation: DrugNetworkAnnotation;
  boardLocked: boolean;
  analystMode: boolean;
  onTextChange: (id: string, text: string) => void;
}

// ─── Shared annotation badge (visible when selected) ─────────────────────────

function AnnotationBadge() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wider text-accent-fg shadow-sm"
    >
      วิเคราะห์
    </span>
  );
}

// ─── annotationShape: RECTANGLE, ELLIPSE, TEXT, IMAGE ─────────────────────────

export function DrugNetworkAnnotationShapeNode({
  data,
  selected,
  width,
  height,
}: NodeProps & { data: DrugNetworkAnnotationNodeData }) {
  const { annotation, boardLocked, analystMode, onTextChange } = data;
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the user double-clicks to enter edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const w = width ?? annotation.type === "RECTANGLE" ? 200 : annotation.type === "ELLIPSE" ? 160 : 180;
  const h = height ?? annotation.type === "RECTANGLE" ? 120 : annotation.type === "ELLIPSE" ? 100 : 60;

  const isResizable = analystMode && !boardLocked;
  const showHandles = isResizable && selected;

  // ── TEXT ──────────────────────────────────────────────────────────────────────
  if (annotation.type === "TEXT") {
    return (
      <div
        className="nodrag-text relative"
        style={{ width: w, minHeight: h }}
        onDoubleClick={(e) => {
          if (!boardLocked && analystMode) {
            e.stopPropagation();
            setEditing(true);
          }
        }}
        data-testid="annotation-text-node"
      >
        {showHandles ? <NodeResizer minWidth={80} minHeight={30} /> : null}
        {selected ? <AnnotationBadge /> : null}
        {editing ? (
          <textarea
            ref={textareaRef}
            className="nodrag nopan w-full resize-none rounded-md border border-accent bg-surface/95 p-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            style={{ fontSize: annotation.fontSize ?? 14, color: annotation.color, minHeight: h, width: w }}
            defaultValue={annotation.text ?? ""}
            onBlur={(e) => {
              onTextChange(annotation.id, e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onTextChange(annotation.id, (e.target as HTMLTextAreaElement).value);
                setEditing(false);
              }
            }}
          />
        ) : (
          <div
            className={cn(
              "whitespace-pre-wrap break-words rounded-md p-1.5",
              selected ? "ring-2 ring-accent ring-dashed ring-offset-1" : "ring-1 ring-dashed ring-border/40"
            )}
            style={{ fontSize: annotation.fontSize ?? 14, color: annotation.color, minHeight: h, width: w }}
            title={analystMode && !boardLocked ? "ดับเบิลคลิกเพื่อแก้ไข" : undefined}
          >
            {annotation.text || (
              <span style={{ opacity: 0.4, fontStyle: "italic", fontSize: 11 }}>
                ข้อความประกอบการวิเคราะห์
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── IMAGE ─────────────────────────────────────────────────────────────────────
  if (annotation.type === "IMAGE") {
    return (
      <div
        className="relative overflow-hidden rounded-lg border-2 border-dashed"
        style={{ width: w, height: h, borderColor: annotation.color }}
        data-testid="annotation-image-node"
      >
        {showHandles ? <NodeResizer minWidth={60} minHeight={40} /> : null}
        {selected ? <AnnotationBadge /> : null}
        {annotation.imageSrc ? (
          <img
            src={annotation.imageSrc}
            alt={annotation.caption ?? "ภาพประกอบของนักวิเคราะห์"}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs italic text-muted">
            ภาพประกอบการวิเคราะห์
          </div>
        )}
        {annotation.caption ? (
          <div className="absolute bottom-0 left-0 right-0 bg-surface/85 px-1.5 py-0.5 text-center text-[10px] text-muted">
            {annotation.caption}
          </div>
        ) : null}
        {selected ? (
          <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-inset ring-accent" />
        ) : null}
      </div>
    );
  }

  // ── RECTANGLE / ELLIPSE ───────────────────────────────────────────────────────
  const strokeW = annotation.strokeWidth;
  const fillValue = annotation.fillColor === "transparent" ? "none" : annotation.fillColor;
  const dashArray = selected ? "8 4" : undefined;

  return (
    <div
      className="relative"
      style={{ width: w, height: h }}
      data-testid={annotation.type === "RECTANGLE" ? "annotation-rect-node" : "annotation-ellipse-node"}
    >
      {showHandles ? <NodeResizer minWidth={40} minHeight={30} /> : null}
      {selected ? <AnnotationBadge /> : null}
      <svg
        width={w}
        height={h}
        style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
        aria-hidden
      >
        {annotation.type === "RECTANGLE" ? (
          <rect
            x={strokeW / 2}
            y={strokeW / 2}
            width={Math.max(1, w - strokeW)}
            height={Math.max(1, h - strokeW)}
            rx={6}
            ry={6}
            stroke={annotation.color}
            strokeWidth={strokeW}
            fill={fillValue}
            strokeDasharray={dashArray}
          />
        ) : (
          <ellipse
            cx={w / 2}
            cy={h / 2}
            rx={Math.max(1, w / 2 - strokeW / 2)}
            ry={Math.max(1, h / 2 - strokeW / 2)}
            stroke={annotation.color}
            strokeWidth={strokeW}
            fill={fillValue}
            strokeDasharray={dashArray}
          />
        )}
      </svg>
    </div>
  );
}

// ─── annotationLine: LINE, ARROW ──────────────────────────────────────────────

export function DrugNetworkAnnotationLineNode({
  data,
  selected,
  width,
  height,
}: NodeProps & { data: DrugNetworkAnnotationNodeData }) {
  const { annotation } = data;
  const endOffset = annotation.endOffset ?? { x: 80, y: 0 };

  /**
   * Compute SVG bounding box. The node's xyflow `position` is the START
   * point (top-left of its bounding box). The SVG draws from the start to
   * the end within a rectangle sized to contain both endpoints plus padding.
   *
   * pad: extra space so thick strokes and arrowheads don't clip at edges.
   */
  const pad = Math.max(annotation.strokeWidth * 2, 12);
  const minX = Math.min(0, endOffset.x);
  const minY = Math.min(0, endOffset.y);
  const svgW = Math.max(1, Math.abs(endOffset.x)) + pad * 2;
  const svgH = Math.max(1, Math.abs(endOffset.y)) + pad * 2;

  const startX = -minX + pad;
  const startY = -minY + pad;
  const endX = endOffset.x - minX + pad;
  const endY = endOffset.y - minY + pad;

  // Unique marker id per annotation to avoid SVG id collisions in the DOM
  const markerId = `arrowhead-${annotation.id}`;

  const nodeW = width ?? svgW;
  const nodeH = height ?? svgH;

  return (
    <div
      className="relative"
      style={{ width: nodeW, height: nodeH }}
      data-testid={annotation.type === "ARROW" ? "annotation-arrow-node" : "annotation-line-node"}
      aria-label={
        annotation.type === "ARROW"
          ? "ลูกศรประกอบการวิเคราะห์ (analyst arrow)"
          : "เส้นประกอบการวิเคราะห์ (analyst line)"
      }
    >
      {selected ? <AnnotationBadge /> : null}
      {/* Transparent hit area for pointer events (the SVG itself is pointer-events:none) */}
      <div className="absolute inset-0" style={{ pointerEvents: "all" }} />
      <svg
        width={nodeW}
        height={nodeH}
        style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
        aria-hidden
      >
        {annotation.type === "ARROW" ? (
          <defs>
            <marker
              id={markerId}
              markerWidth={10}
              markerHeight={7}
              refX={9}
              refY={3.5}
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={annotation.color} />
            </marker>
          </defs>
        ) : null}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={annotation.color}
          strokeWidth={annotation.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={selected ? "10 5" : undefined}
          markerEnd={annotation.type === "ARROW" ? `url(#${markerId})` : undefined}
        />
        {/* Wider invisible stroke for easier hit detection */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="transparent"
          strokeWidth={Math.max(annotation.strokeWidth, 12)}
        />
      </svg>
    </div>
  );
}

// ─── useAnnotationTextEdit (detached callback to avoid stale closures) ────────

/**
 * Returns a stable `handleTextChange` callback for passing into annotation
 * node data. Must be called at the page level so the annotation update flows
 * through the page's annotation state update function.
 */
export function useAnnotationTextEditHandler(
  onUpdate: (id: string, patch: Partial<DrugNetworkAnnotation>) => void
): (id: string, text: string) => void {
  return useCallback(
    (id, text) => onUpdate(id, { text }),
    [onUpdate]
  );
}
