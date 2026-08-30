/**
 * Annotation properties inspector (Phase DI-9.4, Section 23/24).
 *
 * A NON-MODAL inline panel that appears below the canvas when an annotation
 * is selected. This deliberately avoids the full-screen modal Drawer pattern
 * (which the DI-9.2/9.3 retrospective flagged as blocking canvas interaction
 * via its backdrop) — the analyst can change annotation properties AND
 * continue using the toolbar or moving the annotation simultaneously.
 *
 * Critical microcopy (Section 23):
 *   "วัตถุนี้เป็นสิ่งที่ผู้วิเคราะห์เพิ่มเพื่อประกอบการวิเคราะห์
 *    ไม่ใช่ข้อมูลความสัมพันธ์ที่ระบบยืนยัน"
 * This must remain visible whenever the inspector is open so the user always
 * knows they are editing a presentation element, NOT factual intelligence.
 *
 * Board Lock integration: all edit controls are disabled when `boardLocked`.
 * The inspector still renders (read-only inspection is permitted) but every
 * mutation button/picker shows a locked cursor and is non-interactive.
 */
"use client";

import { Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useT } from "@/components/i18n/language_provider";
import { Button } from "@/components/ui/button";
import {
  ANNOTATION_DEFAULT_COLORS,
  ANNOTATION_DEFAULT_FILL_COLORS,
  ANNOTATION_STROKE_WIDTHS,
  ANNOTATION_DEFAULT_FONT_SIZES,
  isShapeAnnotation,
  type DrugNetworkAnnotation,
} from "@/lib/drug_intelligence/drug_network_annotations";

// ─── Type labels ──────────────────────────────────────────────────────────────

const TYPE_LABEL_TH: Record<string, string> = {
  RECTANGLE: "สี่เหลี่ยม",
  ELLIPSE:   "วงรี / วงกลม",
  TEXT:      "ข้อความ",
  LINE:      "เส้นประกอบการวิเคราะห์",
  ARROW:     "ลูกศรประกอบการวิเคราะห์",
  IMAGE:     "ภาพประกอบของนักวิเคราะห์",
};

// ─── Component ────────────────────────────────────────────────────────────────

export interface DrugNetworkAnnotationInspectorProps {
  annotation: DrugNetworkAnnotation;
  boardLocked: boolean;
  onChange: (id: string, patch: Partial<DrugNetworkAnnotation>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function DrugNetworkAnnotationInspector({
  annotation,
  boardLocked,
  onChange,
  onDelete,
  onDuplicate,
}: DrugNetworkAnnotationInspectorProps) {
  const { t } = useT();

  const locked = boardLocked;
  const id = annotation.id;

  return (
    <div
      className="rounded-xl border border-accent/30 bg-surface px-4 py-3 shadow-sm"
      data-testid="annotation-inspector"
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-accent" data-testid="annotation-inspector-title">
            {t("di.network.annotationInspectorTitle")}
          </p>
          <p className="mt-0.5 text-xs text-muted" data-testid="annotation-type-label">
            {TYPE_LABEL_TH[annotation.type] ?? annotation.type}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => !locked && onDuplicate(id)}
            disabled={locked}
            title={t("di.network.annotationDuplicate")}
            aria-label={t("di.network.annotationDuplicate")}
            data-testid="annotation-duplicate-btn"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => !locked && onDelete(id)}
            disabled={locked}
            title={t("di.network.annotationDelete")}
            aria-label={t("di.network.annotationDelete")}
            data-testid="annotation-delete-btn"
            className="text-critical hover:bg-critical-bg hover:text-critical disabled:text-critical/40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* ── Analyst microcopy (Section 23 — must always be visible) ──────── */}
      <p
        className="mb-3 rounded-lg bg-accent/5 px-2.5 py-2 text-[11px] leading-snug text-muted"
        data-testid="annotation-microcopy"
      >
        {t("di.network.annotationMicrocopy")}
      </p>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4">

        {/* Stroke / text color */}
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-medium text-muted">{t("di.network.annotationColor")}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("di.network.annotationColor")}>
            {ANNOTATION_DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={annotation.color === c}
                disabled={locked}
                onClick={() => !locked && onChange(id, { color: c })}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                  annotation.color === c ? "scale-110 border-foreground" : "border-transparent"
                )}
                style={{
                  background: c,
                  boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #d1d5db" : undefined,
                }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Fill color (shapes only) */}
        {isShapeAnnotation(annotation.type) ? (
          <div className="min-w-0">
            <p className="mb-1.5 text-xs font-medium text-muted">{t("di.network.annotationFill")}</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("di.network.annotationFill")}>
              {ANNOTATION_DEFAULT_FILL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={annotation.fillColor === c}
                  disabled={locked}
                  onClick={() => !locked && onChange(id, { fillColor: c })}
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                    annotation.fillColor === c ? "scale-110 border-foreground" : "border-border"
                  )}
                  style={{
                    background: c === "transparent" ? "transparent" : c,
                    backgroundImage: c === "transparent" ? "linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)" : undefined,
                    backgroundSize: c === "transparent" ? "8px 8px" : undefined,
                    backgroundPosition: c === "transparent" ? "0 0,4px 4px" : undefined,
                  }}
                  title={c === "transparent" ? "ไม่มีสี" : c}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Stroke width (non-text) */}
        {annotation.type !== "TEXT" ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">{t("di.network.annotationStroke")}</p>
            <div className="flex gap-1.5" role="group" aria-label={t("di.network.annotationStroke")}>
              {ANNOTATION_STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={annotation.strokeWidth === w}
                  disabled={locked}
                  onClick={() => !locked && onChange(id, { strokeWidth: w })}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                    annotation.strokeWidth === w
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:bg-neutral-bg"
                  )}
                  title={`${w} px`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Font size (text only) */}
        {annotation.type === "TEXT" ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">{t("di.network.annotationFontSize")}</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("di.network.annotationFontSize")}>
              {ANNOTATION_DEFAULT_FONT_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  aria-pressed={annotation.fontSize === sz}
                  disabled={locked}
                  onClick={() => !locked && onChange(id, { fontSize: sz })}
                  className={cn(
                    "flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed",
                    annotation.fontSize === sz
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:bg-neutral-bg"
                  )}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Caption (image only) */}
        {annotation.type === "IMAGE" ? (
          <div className="w-full">
            <p className="mb-1.5 text-xs font-medium text-muted">{t("di.network.annotationCaption")}</p>
            <input
              type="text"
              value={annotation.caption ?? ""}
              disabled={locked}
              onChange={(e) => !locked && onChange(id, { caption: e.target.value })}
              placeholder={t("di.network.annotationCaptionPlaceholder")}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        ) : null}
      </div>

      {/* Board locked notice */}
      {locked ? (
        <p className="mt-3 text-[11px] text-warning" data-testid="annotation-locked-notice">
          {t("di.network.annotationLockedNotice")}
        </p>
      ) : null}
    </div>
  );
}
