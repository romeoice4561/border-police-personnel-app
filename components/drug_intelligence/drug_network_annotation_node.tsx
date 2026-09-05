/**
 * Custom @xyflow/react node renderers for analyst annotations (Phase DI-9.4 / DI-9.4.1).
 *
 * Two node types are registered in the page's nodeTypes map:
 *   "annotationShape" — RECTANGLE, ELLIPSE, TEXT, IMAGE
 *   "annotationLine"  — LINE, ARROW
 *
 * DI-9.4.1 enhancements:
 *   - PowerPoint-style resize handles (more visible, using NodeResizer handleStyle)
 *   - LINE/ARROW endpoint handles: two draggable circles at start and end
 *   - TEXT auto-focus: enters edit mode immediately when autoFocus=true
 *   - strokeDash support (solid/dashed/dotted) in SVG rendering
 *
 * CRITICAL architecture (DI-9.4 Section 0):
 * - These nodes are PRESENTATION ONLY. They carry no DrugGraphNode, no
 *   DrugGraphEdge, no relationship evidence, no edgeKind.
 * - NodeResizer is used for SHAPE annotations ONLY — never applied to
 *   factual "drugGraphNode" nodes.
 * - Annotation nodes are visually distinct from factual nodes.
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import {
  strokeDashArray,
  type DrugNetworkAnnotation,
} from "@/lib/drug_intelligence/drug_network_annotations";

// ─── Data interface ────────────────────────────────────────────────────────────

export interface DrugNetworkAnnotationNodeData extends Record<string, unknown> {
  annotation: DrugNetworkAnnotation;
  boardLocked: boolean;
  analystMode: boolean;
  onTextChange: (id: string, text: string) => void;
  /** When true, TEXT node immediately enters editing mode (e.g. just created). */
  autoFocus?: boolean;
  /**
   * Called when user drags an endpoint handle on a LINE/ARROW node.
   * `newGraphPos` is the graph-space position the handle was dragged to.
   */
  onEndpointDrag?: (id: string, endpoint: "start" | "end", newGraphPos: { x: number; y: number }) => void;
  /**
   * React Flow's screenToFlowPosition — passed from the page's useReactFlow()
   * so endpoint handles can convert screen coords to graph coords.
   */
  screenToFlowPosition?: (pos: { x: number; y: number }) => { x: number; y: number };
}

// ─── PowerPoint-style NodeResizer handle style ────────────────────────────────

const RESIZE_HANDLE_STYLE: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 2,
  background: "#ffffff",
  border: "2px solid #3b82f6",
  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
};

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
  const { t } = useT();
  // Auto-focus: enter edit mode immediately when annotation was just created
  const [editing, setEditing] = useState(() => Boolean(data.autoFocus) && annotation.type === "TEXT" && analystMode && !boardLocked);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clear autoFocus after first render so switching away + back doesn't re-trigger
  const autoFocusConsumedRef = useRef(false);
  useEffect(() => {
    if (!autoFocusConsumedRef.current && data.autoFocus && annotation.type === "TEXT" && analystMode && !boardLocked) {
      autoFocusConsumedRef.current = true;
      setEditing(true);
    }
  }, [data.autoFocus, annotation.type, analystMode, boardLocked]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Put cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const w = width ?? (annotation.type === "RECTANGLE" ? 200 : annotation.type === "ELLIPSE" ? 160 : 180);
  const h = height ?? (annotation.type === "RECTANGLE" ? 120 : annotation.type === "ELLIPSE" ? 100 : 60);

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
        {showHandles ? (
          <NodeResizer
            minWidth={80}
            minHeight={30}
            handleStyle={RESIZE_HANDLE_STYLE}
            lineStyle={{ borderColor: "#3b82f6", borderWidth: 1, borderStyle: "dashed" }}
          />
        ) : null}
        {selected ? <AnnotationBadge /> : null}
        {editing ? (
          <textarea
            ref={textareaRef}
            className="nodrag nopan w-full resize-none rounded-md border border-accent bg-surface/95 p-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            style={{ fontSize: annotation.fontSize ?? 14, color: annotation.color, minHeight: h, width: w, cursor: "text" }}
            defaultValue={annotation.text ?? ""}
            onBlur={(e) => {
              onTextChange(annotation.id, e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              // Suppress V/H shortcuts while typing
              e.stopPropagation();
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
              selected ? "ring-2 ring-accent ring-dashed ring-offset-1" : "ring-1 ring-dashed ring-border/40",
              analystMode && !boardLocked ? "cursor-text" : ""
            )}
            style={{ fontSize: annotation.fontSize ?? 14, color: annotation.color, minHeight: h, width: w }}
            title={analystMode && !boardLocked ? "ดับเบิลคลิกเพื่อแก้ไข" : undefined}
          >
            {annotation.text || (
              <span style={{ opacity: 0.4, fontStyle: "italic", fontSize: 11 }}>
                {analystMode ? "คลิกเพื่อพิมพ์..." : "ข้อความประกอบการวิเคราะห์"}
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
        {showHandles ? (
          <NodeResizer
            minWidth={60}
            minHeight={40}
            keepAspectRatio
            handleStyle={RESIZE_HANDLE_STYLE}
            lineStyle={{ borderColor: "#3b82f6", borderWidth: 1, borderStyle: "dashed" }}
          />
        ) : null}
        {selected ? <AnnotationBadge /> : null}
        {annotation.imageSrc ? (
          <img
            src={annotation.imageSrc}
            alt={annotation.caption ?? "ภาพประกอบของนักวิเคราะห์"}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div
            className="flex h-full items-center justify-center px-2 text-center text-xs italic text-muted"
            data-testid={annotation.imageUnavailable ? "annotation-image-unavailable" : "annotation-image-placeholder"}
          >
            {annotation.imageUnavailable ? t("di.board.imageUnavailable") : "ภาพประกอบการวิเคราะห์"}
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
  const dashArr = strokeDashArray(annotation.strokeDash, strokeW) ?? (selected ? "8 4" : undefined);

  return (
    <div
      className="relative"
      style={{ width: w, height: h }}
      data-testid={annotation.type === "RECTANGLE" ? "annotation-rect-node" : "annotation-ellipse-node"}
    >
      {showHandles ? (
        <NodeResizer
          minWidth={40}
          minHeight={30}
          handleStyle={RESIZE_HANDLE_STYLE}
          lineStyle={{ borderColor: "#3b82f6", borderWidth: 1, borderStyle: "dashed" }}
        />
      ) : null}
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
            strokeDasharray={dashArr}
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
            strokeDasharray={dashArr}
          />
        )}
      </svg>
    </div>
  );
}

// ─── annotationLine: LINE, ARROW ──────────────────────────────────────────────

export function DrugNetworkAnnotationLineNode({
  id: nodeId,
  data,
  selected,
  positionAbsoluteX,
  positionAbsoluteY,
  width,
  height,
}: NodeProps & { data: DrugNetworkAnnotationNodeData }) {
  const { annotation, boardLocked, analystMode } = data;
  const endOffset = annotation.endOffset ?? { x: 80, y: 0 };

  const pad = Math.max(annotation.strokeWidth * 2, 12);
  const minX = Math.min(0, endOffset.x);
  const minY = Math.min(0, endOffset.y);
  const svgW = Math.max(1, Math.abs(endOffset.x)) + pad * 2;
  const svgH = Math.max(1, Math.abs(endOffset.y)) + pad * 2;

  const startX = -minX + pad;
  const startY = -minY + pad;
  const endX = endOffset.x - minX + pad;
  const endY = endOffset.y - minY + pad;

  const markerId = `arrowhead-${annotation.id}`;

  const nodeW = width ?? svgW;
  const nodeH = height ?? svgH;

  const showEndpointHandles = selected && analystMode && !boardLocked;

  // ── Endpoint drag handling ────────────────────────────────────────────────────
  const endpointDragRef = useRef<{ endpoint: "start" | "end"; pointerId: number } | null>(null);

  const handleEndpointPointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    endpoint: "start" | "end"
  ) => {
    e.stopPropagation(); // prevent xyflow node drag
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    endpointDragRef.current = { endpoint, pointerId: e.pointerId };
  }, []);

  const handleEndpointPointerMove = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    endpoint: "start" | "end"
  ) => {
    if (!endpointDragRef.current || endpointDragRef.current.endpoint !== endpoint) return;
    if (!(e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) return;
    const s2f = data.screenToFlowPosition;
    if (!s2f || !data.onEndpointDrag) return;
    const newGraphPos = s2f({ x: e.clientX, y: e.clientY });
    data.onEndpointDrag(annotation.id, endpoint, newGraphPos);
  }, [data, annotation.id]);

  const handleEndpointPointerUp = useCallback((
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!endpointDragRef.current) return;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    endpointDragRef.current = null;
  }, []);

  const dashArr = strokeDashArray(annotation.strokeDash, annotation.strokeWidth) ?? (selected ? "10 5" : undefined);

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
      {/* Transparent hit area for pointer events */}
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
          strokeDasharray={dashArr}
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

      {/* ── Endpoint handles (DI-9.4.1 Section 9) ────────────────────────────── */}
      {showEndpointHandles ? (
        <>
          {/* START handle */}
          <div
            style={{
              position: "absolute",
              left: startX - 6,
              top: startY - 6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#ffffff",
              border: "2px solid #3b82f6",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              cursor: "crosshair",
              zIndex: 10,
              touchAction: "none",
            }}
            title="ลากเพื่อย้ายจุดเริ่มต้น"
            onPointerDown={(e) => handleEndpointPointerDown(e, "start")}
            onPointerMove={(e) => handleEndpointPointerMove(e, "start")}
            onPointerUp={handleEndpointPointerUp}
            onPointerCancel={handleEndpointPointerUp}
          />
          {/* END handle */}
          <div
            style={{
              position: "absolute",
              left: endX - 6,
              top: endY - 6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: annotation.type === "ARROW" ? annotation.color : "#ffffff",
              border: `2px solid ${annotation.color}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              cursor: "crosshair",
              zIndex: 10,
              touchAction: "none",
            }}
            title="ลากเพื่อย้ายจุดปลาย"
            onPointerDown={(e) => handleEndpointPointerDown(e, "end")}
            onPointerMove={(e) => handleEndpointPointerMove(e, "end")}
            onPointerUp={handleEndpointPointerUp}
            onPointerCancel={handleEndpointPointerUp}
          />
        </>
      ) : null}
    </div>
  );
}

// ─── useAnnotationTextEdit (detached callback to avoid stale closures) ────────

export function useAnnotationTextEditHandler(
  onUpdate: (id: string, patch: Partial<DrugNetworkAnnotation>) => void
): (id: string, text: string) => void {
  return useCallback(
    (id, text) => onUpdate(id, { text }),
    [onUpdate]
  );
}
