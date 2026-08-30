/**
 * Floating contextual annotation property bar (Phase DI-9.4.1, Section 14).
 *
 * A compact inline bar shown when an annotation is selected in Analyst Mode.
 * Positioned at the top of the canvas (inside the canvas container, not below it)
 * so the analyst does not need to scroll down to change color/width/dash.
 *
 * Adapts its controls to the annotation type:
 *   - Line/Arrow:  stroke color | stroke width | dash style | duplicate | delete
 *   - Shape:       stroke color | fill color   | stroke width | dash | duplicate | delete
 *   - Text:        text color   | font size    | duplicate | delete
 *   - Image:       duplicate | delete
 *
 * Board Lock: all mutation controls are hidden when `boardLocked` is true.
 * The bar itself is only rendered in Analyst Mode (caller responsibility).
 */
"use client";

import { Trash2, Copy, Minus } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  ANNOTATION_DEFAULT_COLORS,
  ANNOTATION_DEFAULT_FILL_COLORS,
  ANNOTATION_STROKE_WIDTHS,
  ANNOTATION_DEFAULT_FONT_SIZES,
  ANNOTATION_STROKE_DASHES,
  isShapeAnnotation,
  isLineAnnotation,
  type DrugNetworkAnnotation,
  type DrugNetworkAnnotationStrokeDash,
} from "@/lib/drug_intelligence/drug_network_annotations";

// ── A small 5-color palette (most common) for the floating bar ───────────────
const FLOAT_COLORS = ["#000000", "#ef4444", "#f97316", "#22c55e", "#3b82f6", "#8b5cf6", "#ffffff"];
const FLOAT_FILL_COLORS = ["transparent", "#fef2f2", "#fff7ed", "#f0fdf4", "#eff6ff"];

const DASH_LABELS: Record<DrugNetworkAnnotationStrokeDash, string> = {
  solid: "—",
  dashed: "- -",
  dotted: "···",
};

export interface DrugNetworkAnnotationFloatingBarProps {
  annotation: DrugNetworkAnnotation;
  boardLocked: boolean;
  onChange: (id: string, patch: Partial<DrugNetworkAnnotation>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function DrugNetworkAnnotationFloatingBar({
  annotation,
  boardLocked,
  onChange,
  onDelete,
  onDuplicate,
}: DrugNetworkAnnotationFloatingBarProps) {
  const id = annotation.id;
  const isShape = isShapeAnnotation(annotation.type);
  const isLine = isLineAnnotation(annotation.type);
  const isText = annotation.type === "TEXT";
  const showDash = isShape || isLine;

  return (
    <div
      className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-surface/95 px-3 py-1.5 shadow-lg backdrop-blur-sm"
      data-testid="annotation-floating-bar"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ── Stroke / text color ───────────────────────────────────────────── */}
      {!isText ? (
        <div className="flex items-center gap-1" role="group" aria-label="สีเส้น">
          <span className="text-[10px] text-muted">เส้น</span>
          {FLOAT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={boardLocked}
              onClick={() => !boardLocked && onChange(id, { color: c })}
              aria-pressed={annotation.color === c}
              title={c}
              className={cn(
                "h-4 w-4 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                annotation.color === c ? "scale-125 ring-2 ring-accent ring-offset-1" : "hover:scale-110"
              )}
              style={{
                background: c,
                boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #d1d5db" : undefined,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1" role="group" aria-label="สีข้อความ">
          <span className="text-[10px] text-muted">ข้อความ</span>
          {FLOAT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={boardLocked}
              onClick={() => !boardLocked && onChange(id, { color: c })}
              aria-pressed={annotation.color === c}
              title={c}
              className={cn(
                "h-4 w-4 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                annotation.color === c ? "scale-125 ring-2 ring-accent ring-offset-1" : "hover:scale-110"
              )}
              style={{
                background: c,
                boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #d1d5db" : undefined,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Fill color (shapes only) ────────────────────────────────────── */}
      {isShape ? (
        <>
          <div className="h-4 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-1" role="group" aria-label="สีพื้น">
            <span className="text-[10px] text-muted">พื้น</span>
            {FLOAT_FILL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={boardLocked}
                onClick={() => !boardLocked && onChange(id, { fillColor: c })}
                aria-pressed={annotation.fillColor === c}
                title={c === "transparent" ? "โปร่งใส" : c}
                className={cn(
                  "h-4 w-4 rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                  annotation.fillColor === c ? "scale-125 ring-2 ring-accent ring-offset-1 border-foreground" : "border-border hover:scale-110"
                )}
                style={{
                  background: c === "transparent" ? "transparent" : c,
                  backgroundImage: c === "transparent" ? "linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)" : undefined,
                  backgroundSize: c === "transparent" ? "6px 6px" : undefined,
                  backgroundPosition: c === "transparent" ? "0 0,3px 3px" : undefined,
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      {/* ── Stroke width ─────────────────────────────────────────────────── */}
      {!isText ? (
        <>
          <div className="h-4 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-1" role="group" aria-label="ความหนาเส้น">
            {ANNOTATION_STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                disabled={boardLocked}
                onClick={() => !boardLocked && onChange(id, { strokeWidth: w })}
                aria-pressed={annotation.strokeWidth === w}
                title={`${w}px`}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                  annotation.strokeWidth === w
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-neutral-bg"
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* ── Font size (text only) ────────────────────────────────────────── */}
      {isText ? (
        <>
          <div className="h-4 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-1" role="group" aria-label="ขนาดตัวอักษร">
            <span className="text-[10px] text-muted">ขนาด</span>
            {ANNOTATION_DEFAULT_FONT_SIZES.slice(0, 4).map((sz) => (
              <button
                key={sz}
                type="button"
                disabled={boardLocked}
                onClick={() => !boardLocked && onChange(id, { fontSize: sz })}
                aria-pressed={annotation.fontSize === sz}
                title={`${sz}pt`}
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                  annotation.fontSize === sz ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg"
                )}
              >
                {sz}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* ── Dash style ───────────────────────────────────────────────────── */}
      {showDash ? (
        <>
          <div className="h-4 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-0.5" role="group" aria-label="รูปแบบเส้น">
            {ANNOTATION_STROKE_DASHES.map((dash) => (
              <button
                key={dash}
                type="button"
                disabled={boardLocked}
                onClick={() => !boardLocked && onChange(id, { strokeDash: dash })}
                aria-pressed={(annotation.strokeDash ?? "solid") === dash}
                title={dash === "solid" ? "เส้นทึบ" : dash === "dashed" ? "เส้นประ" : "เส้นจุด"}
                className={cn(
                  "flex h-5 min-w-7 items-center justify-center rounded px-1 font-mono text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                  (annotation.strokeDash ?? "solid") === dash
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-neutral-bg"
                )}
              >
                {DASH_LABELS[dash]}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* ── Divider before actions ───────────────────────────────────────── */}
      <div className="h-4 w-px bg-border" aria-hidden />

      {/* ── Duplicate ────────────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={boardLocked}
        onClick={() => !boardLocked && onDuplicate(id)}
        title="ทำสำเนา"
        aria-label="ทำสำเนา"
        className="flex h-5 w-5 items-center justify-center rounded text-muted transition-colors hover:bg-neutral-bg hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
        data-testid="floating-bar-duplicate-btn"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
      </button>

      {/* ── Delete ───────────────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={boardLocked}
        onClick={() => !boardLocked && onDelete(id)}
        title="ลบวัตถุ"
        aria-label="ลบวัตถุ"
        className="flex h-5 w-5 items-center justify-center rounded text-critical transition-colors hover:bg-critical-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical disabled:cursor-not-allowed disabled:opacity-40"
        data-testid="floating-bar-delete-btn"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
