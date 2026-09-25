/**
 * DI-8.7 V1.5A — "นาฬิกาอาชญากรรม" (Crime Clock) interactive 24-hour dial.
 * VISUAL HOTFIX 2 — readability pass: larger dial, exact counts printed
 * inside non-zero segments, TWO independent visual signals (accent
 * intensity for frequency + a distinct outline/ring for selection so a
 * low-frequency selected hour never looks unselected), and an
 * intentional center readout (24h total, or the active selection +
 * match count).
 *
 * V1.5B SELECTION-READABILITY POLISH: a broad selection (e.g. 00:00–
 * 12:59, ~13 segments) previously drew a bright per-segment
 * stroke-foreground ring around EVERY selected wedge, including the
 * internal boundaries between adjacent selected segments — this read as
 * a grid of white lines competing with the orange frequency fill. Fixed
 * by moving selection encoding to a SINGLE thin outer arc spanning the
 * whole selected range (drawn once, outside the dial), while each
 * segment's own stroke returns to the same subtle divider used for
 * unselected segments. Frequency fill/opacity + the exact count label
 * remain the dominant, per-segment signal; the outer arc is a
 * secondary, unambiguous "this is the selected span" indicator.
 *
 * Pure presentation; all filtering/aggregation math lives in
 * lib/drug_intelligence/drug_temporal_explorer.ts (no second temporal
 * engine here, no second aggregation — this component only projects
 * the SAME hourlyDistribution the histogram/summary/coverage cards
 * already consume).
 *
 * Interaction (Section 15, carried over from V1.5A, unchanged): click
 * one hour segment (selects that single hour), click-drag across
 * segments (continuous range, wrapping through midnight when dragged
 * past 23). Start/end HH:MM controls and the clear-time action now
 * live in the parent panel (drug_temporal_explorer_panel.tsx) directly
 * under this dial, per Section 19's "make their relationship to the
 * clock clearer" — this component owns only the dial + center readout.
 *
 * Frequency intensity is a neutral accent-opacity scale — never
 * red/danger color (Section 7/22).
 */
"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import type { HourlyBucket } from "@/lib/drug_intelligence/drug_temporal_explorer";

const SIZE = 384;
const CENTER = SIZE / 2;
const OUTER_R = 164;
const INNER_R = 92;
const LABEL_R = 140;
const COUNT_R = 128;
/** The single outer selection-arc ring sits just outside the dial's own segments. */
const SELECTION_ARC_R = OUTER_R + 12;

function hourToAngle(hour: number): number {
  // 00:00 at the top (12 o'clock), clockwise, 15° per hour.
  return (hour / 24) * 360 - 90;
}

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function segmentPath(hour: number, innerR: number, outerR: number): string {
  const a0 = hourToAngle(hour);
  const a1 = hourToAngle(hour + 1);
  const p0o = polar(CENTER, CENTER, outerR, a0);
  const p1o = polar(CENTER, CENTER, outerR, a1);
  const p1i = polar(CENTER, CENTER, innerR, a1);
  const p0i = polar(CENTER, CENTER, innerR, a0);
  return `M ${p0o.x} ${p0o.y} A ${outerR} ${outerR} 0 0 1 ${p1o.x} ${p1o.y} L ${p1i.x} ${p1i.y} A ${innerR} ${innerR} 0 0 0 ${p0i.x} ${p0i.y} Z`;
}

/**
 * Builds the outer selection-arc SVG path(s) for a set of selected
 * hours. A contiguous run of hours (e.g. {0,1,...,12}) becomes ONE arc
 * spanning hour 0's start to hour 12's end; a midnight-wrap selection
 * that splits into two runs around the array boundary (e.g. {22,23,0,1})
 * is still one contiguous angular run and stays a single arc. Only a
 * genuinely non-contiguous set (not producible by the current click/drag
 * interaction, but defensive) would emit multiple arcs.
 */
function selectionArcPaths(selectedHours: ReadonlySet<number>): string[] {
  if (selectedHours.size === 0) return [];
  if (selectedHours.size === 24) {
    // Full circle: draw as two half-arcs (a single 360° arc command is degenerate in SVG).
    const half1 = arcPath(hourToAngle(0), hourToAngle(12));
    const half2 = arcPath(hourToAngle(12), hourToAngle(24));
    return [half1, half2];
  }
  // Find contiguous runs over the circular hour sequence 0..23.
  const runs: Array<{ start: number; end: number }> = [];
  const sorted = [...selectedHours].sort((a, b) => a - b);
  const visited = new Set<number>();
  for (const startCandidate of sorted) {
    if (visited.has(startCandidate)) continue;
    // Walk backward to find the true start of this run (handles wrap).
    let runStart = startCandidate;
    while (selectedHours.has((runStart - 1 + 24) % 24) && !visited.has((runStart - 1 + 24) % 24)) {
      runStart = (runStart - 1 + 24) % 24;
      if (runStart === startCandidate) break; // full circle guard
    }
    let runEnd = runStart;
    visited.add(runStart);
    while (selectedHours.has((runEnd + 1) % 24) && !visited.has((runEnd + 1) % 24)) {
      runEnd = (runEnd + 1) % 24;
      visited.add(runEnd);
      if (runEnd === runStart) break;
    }
    runs.push({ start: runStart, end: runEnd });
  }
  return runs.map((run) => {
    const startAngle = hourToAngle(run.start);
    const endAngle = run.end >= run.start ? hourToAngle(run.end + 1) : hourToAngle(run.end + 1 + 24);
    return arcPath(startAngle, endAngle);
  });
}

function arcPath(startAngleDeg: number, endAngleDeg: number): string {
  const p0 = polar(CENTER, CENTER, SELECTION_ARC_R, startAngleDeg);
  const p1 = polar(CENTER, CENTER, SELECTION_ARC_R, endAngleDeg);
  const largeArc = endAngleDeg - startAngleDeg > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${SELECTION_ARC_R} ${SELECTION_ARC_R} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}

/** Hours covered by [startMinute, endMinute), honoring midnight wrap. */
export function hoursInRange(startMinute: number, endMinute: number): Set<number> {
  const startHour = Math.floor(startMinute / 60);
  const endHour = Math.floor((endMinute - 1 + 1440) % 1440 / 60); // last minute included, hour-of that minute
  const hours = new Set<number>();
  if (startMinute === endMinute) return hours;
  if (startMinute < endMinute) {
    for (let h = startHour; h <= endHour; h++) hours.add(h);
  } else {
    // wrap: startHour..23, then 0..endHour
    for (let h = startHour; h <= 23; h++) hours.add(h);
    for (let h = 0; h <= endHour; h++) hours.add(h);
  }
  return hours;
}

const ANCHOR_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

export function DrugCrimeClock({
  hourlyDistribution,
  startMinute,
  endMinute,
  matchingCaseCount,
  totalCaseCount,
  onSelectRange,
  className,
}: {
  hourlyDistribution: readonly HourlyBucket[];
  /** Active time-filter bounds, or undefined when no time filter is active (shows all 24 hours evenly). */
  startMinute?: number;
  endMinute?: number;
  /** Center readout: how many cases the CURRENT full selection matches (Section 8). */
  matchingCaseCount: number;
  /** Center readout when no time range is selected: total cases in scope. */
  totalCaseCount: number;
  /** Minute-of-day bounds; end is EXCLUSIVE of the following hour (e.g. clicking hour 18 alone => 18*60, 19*60). */
  onSelectRange: (startMinute: number, endMinute: number) => void;
  className?: string;
}) {
  const { t } = useT();
  const titleId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStartHour, setDragStartHour] = useState<number | null>(null);
  const [dragHoverHour, setDragHoverHour] = useState<number | null>(null);
  const [focusedHour, setFocusedHour] = useState<number | null>(null);

  const maxCount = useMemo(() => Math.max(1, ...hourlyDistribution.map((b) => b.count)), [hourlyDistribution]);

  const activeHours = useMemo(() => {
    if (startMinute == null || endMinute == null) return null;
    return hoursInRange(startMinute, endMinute);
  }, [startMinute, endMinute]);

  const previewHours = useMemo(() => {
    if (dragStartHour == null || dragHoverHour == null) return null;
    const a = dragStartHour;
    const b = dragHoverHour;
    // Build a forward-clockwise span from a to b (inclusive), wrapping through 0 if needed.
    const hours = new Set<number>();
    let h = a;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      hours.add(h);
      if (h === b) break;
      h = (h + 1) % 24;
    }
    return hours;
  }, [dragStartHour, dragHoverHour]);

  const hourFromPointer = useCallback((clientX: number, clientY: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    const x = (clientX - rect.left) * scaleX - CENTER;
    const y = (clientY - rect.top) * scaleY - CENTER;
    const dist = Math.hypot(x, y);
    if (dist < INNER_R - 8 || dist > OUTER_R + 8) return null;
    let angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;
    const hour = Math.floor((angle / 360) * 24) % 24;
    return hour;
  }, []);

  const commitRange = useCallback(
    (a: number, b: number) => {
      const startH = a;
      const endHourInclusive = b;
      const start = startH * 60;
      // end is exclusive of the hour AFTER endHourInclusive, e.g. selecting only hour 18 => 18:00-19:00
      const end = ((endHourInclusive + 1) % 24) * 60 || 24 * 60;
      onSelectRange(start, end === 0 ? 24 * 60 : end);
    },
    [onSelectRange],
  );

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const hour = hourFromPointer(e.clientX, e.clientY);
    if (hour == null) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragStartHour(hour);
    setDragHoverHour(hour);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (dragStartHour == null) return;
    const hour = hourFromPointer(e.clientX, e.clientY);
    if (hour == null) return;
    setDragHoverHour(hour);
  }

  function handlePointerUp() {
    if (dragStartHour != null && dragHoverHour != null) {
      commitRange(dragStartHour, dragHoverHour);
    }
    setDragStartHour(null);
    setDragHoverHour(null);
  }

  function handleHourKeyActivate(hour: number) {
    commitRange(hour, hour);
  }

  const effectiveHighlight = previewHours ?? activeHours;
  const timeActive = startMinute != null && endMinute != null;

  const centerRangeLabel = (() => {
    if (!timeActive) return null;
    const startH = String(Math.floor(startMinute! / 60)).padStart(2, "0");
    const startM = String(startMinute! % 60).padStart(2, "0");
    const endMinuteDisplay = endMinute === 24 * 60 ? 0 : endMinute!;
    const endH = String(Math.floor(endMinuteDisplay / 60)).padStart(2, "0");
    const endM = String(endMinuteDisplay % 60).padStart(2, "0");
    return `${startH}:${startM}–${endH}:${endM}`;
  })();

  return (
    <div className={cn("flex flex-col items-center", className)} data-testid="crime-clock">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={titleId}
        className="h-75 w-75 shrink-0 touch-none select-none sm:h-85 sm:w-85 lg:h-90 lg:w-90"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (dragStartHour == null) return;
          // finalize using last known hover on leave, so a drag off-canvas still commits
          if (dragHoverHour != null) commitRange(dragStartHour, dragHoverHour);
          setDragStartHour(null);
          setDragHoverHour(null);
        }}
      >
        <title id={titleId}>{t("di.temporal.title")}</title>
        {effectiveHighlight && effectiveHighlight.size > 0
          ? selectionArcPaths(effectiveHighlight).map((d, i) => (
              <path
                key={`selection-arc-${i}`}
                d={d}
                fill="none"
                className="stroke-foreground"
                strokeWidth={3}
                strokeLinecap="round"
                data-testid="crime-clock-selection-arc"
                aria-hidden="true"
              />
            ))
          : null}
        {hourlyDistribution.map((bucket) => {
          const isSelected = effectiveHighlight?.has(bucket.hour) ?? false;
          // Signal A: accent fill-opacity encodes frequency (never selection).
          const intensity = bucket.count === 0 ? 0.08 : 0.22 + 0.6 * (bucket.count / maxCount);
          const countPos = polar(CENTER, CENTER, COUNT_R, hourToAngle(bucket.hour) + 7.5);
          const hourLabel = `${String(bucket.hour).padStart(2, "0")}:00`;
          const hourEndLabel = `${String(bucket.hour).padStart(2, "0")}:59`;
          const accessibleLabel =
            t("di.temporal.hourAccessibleLabel")
              .replace("{start}", hourLabel)
              .replace("{end}", hourEndLabel)
              .replace("{count}", String(bucket.count)) + (isSelected ? ` — ${t("di.temporal.hourSelectedSuffix")}` : "");
          return (
            <g key={bucket.hour}>
              <path
                d={segmentPath(bucket.hour, INNER_R, OUTER_R)}
                // Signal B (selection) now lives ONLY in the single outer
                // selection arc drawn above — never as a per-segment
                // stroke. A broad multi-hour selection previously drew a
                // bright ring around EVERY selected wedge (including the
                // internal boundaries between adjacent selected hours),
                // which read as a grid of white lines competing with the
                // orange frequency fill. Every segment now uses the SAME
                // subtle divider stroke regardless of selection state —
                // frequency fill/opacity + the exact count label stay the
                // dominant per-segment signal.
                className="cursor-pointer fill-accent stroke-surface transition-[fill-opacity]"
                style={{ fillOpacity: intensity }}
                strokeWidth={1}
                tabIndex={0}
                role="button"
                aria-label={accessibleLabel}
                aria-pressed={isSelected}
                onFocus={() => setFocusedHour(bucket.hour)}
                onBlur={() => setFocusedHour((h) => (h === bucket.hour ? null : h))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleHourKeyActivate(bucket.hour);
                  }
                }}
                onClick={() => {
                  // A plain click (no drag) selects the single hour.
                  if (dragStartHour == null) handleHourKeyActivate(bucket.hour);
                }}
                data-testid={`crime-clock-hour-${bucket.hour}`}
                data-hour={bucket.hour}
                data-count={bucket.count}
                data-selected={isSelected ? "true" : "false"}
              >
                <title>
                  {t("di.temporal.hourTooltip").replace("{hour}", String(bucket.hour).padStart(2, "0")).replace("{count}", String(bucket.count))}
                  {bucket.count > 0 ? ` (${bucket.percentOfCasesWithTime}%)` : ""}
                </title>
              </path>
              {bucket.count > 0 ? (
                <text
                  x={countPos.x}
                  y={countPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={cn(
                    "pointer-events-none select-none text-[15px] font-semibold",
                    isSelected ? "fill-foreground" : "fill-foreground/80",
                  )}
                  data-testid={`crime-clock-hour-${bucket.hour}-count-label`}
                >
                  {bucket.count}
                </text>
              ) : null}
            </g>
          );
        })}

        {ANCHOR_HOURS.map((hour) => {
          const pos = polar(CENTER, CENTER, LABEL_R, hourToAngle(hour) + 7.5);
          return (
            <text
              key={hour}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none fill-muted text-[13px] font-semibold"
            >
              {String(hour).padStart(2, "0")}
            </text>
          );
        })}

        <circle cx={CENTER} cy={CENTER} r={INNER_R - 4} className="fill-surface stroke-border" strokeWidth={1} />

        {/* Center readout (Section 8): hover a segment for that hour's detail; otherwise show the CURRENT selection state. */}
        {focusedHour != null ? (
          <>
            <text x={CENTER} y={CENTER - 10} textAnchor="middle" className="fill-foreground text-base font-semibold" data-testid="crime-clock-center-hour">
              {String(focusedHour).padStart(2, "0")}:00–{String(focusedHour).padStart(2, "0")}:59
            </text>
            <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="fill-muted text-sm">
              {t("di.temporal.centerHourCases").replace("{count}", String(hourlyDistribution[focusedHour]?.count ?? 0))}
            </text>
          </>
        ) : timeActive ? (
          <>
            <text x={CENTER} y={CENTER - 10} textAnchor="middle" className="fill-foreground text-base font-semibold" data-testid="crime-clock-center-range">
              {centerRangeLabel}
            </text>
            <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="fill-accent text-sm font-medium" data-testid="crime-clock-center-count">
              {t("di.temporal.matchingCaseCount").replace("{count}", String(matchingCaseCount))}
            </text>
          </>
        ) : (
          <>
            <text x={CENTER} y={CENTER - 10} textAnchor="middle" className="fill-foreground text-base font-semibold" data-testid="crime-clock-center-full">
              {t("di.temporal.centerFullDay")}
            </text>
            <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="fill-accent text-sm font-medium" data-testid="crime-clock-center-count">
              {t("di.temporal.centerTotalCases").replace("{count}", String(totalCaseCount))}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
