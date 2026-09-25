/**
 * DI-8.7 V1.5A — VISUAL HOTFIX 2 — "จำนวนคดีรายชั่วโมง" 24-column
 * histogram. A LINEAR reading of the exact same hourlyDistribution the
 * radial clock already consumes — never a second aggregation.
 *
 * Interaction manipulates the SAME TemporalSelection as the clock:
 * clicking a bar selects that single hour; drag across bars selects a
 * continuous range (wrapping through midnight past hour 23), using the
 * identical minute-of-day commit semantics the clock's click/drag use.
 * There is no independent histogram selection state.
 */
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import type { HourlyBucket } from "@/lib/drug_intelligence/drug_temporal_explorer";
import { hoursInRange } from "@/components/drug_intelligence/drug_crime_clock";

export function DrugCrimeClockHistogram({
  hourlyDistribution,
  startMinute,
  endMinute,
  onSelectRange,
  className,
}: {
  hourlyDistribution: readonly HourlyBucket[];
  startMinute?: number;
  endMinute?: number;
  onSelectRange: (startMinute: number, endMinute: number) => void;
  className?: string;
}) {
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStartHour, setDragStartHour] = useState<number | null>(null);
  const [dragHoverHour, setDragHoverHour] = useState<number | null>(null);

  const maxCount = useMemo(() => Math.max(1, ...hourlyDistribution.map((b) => b.count)), [hourlyDistribution]);

  const activeHours = useMemo(() => {
    if (startMinute == null || endMinute == null) return null;
    return hoursInRange(startMinute, endMinute);
  }, [startMinute, endMinute]);

  const previewHours = useMemo(() => {
    if (dragStartHour == null || dragHoverHour == null) return null;
    const lo = Math.min(dragStartHour, dragHoverHour);
    const hi = Math.max(dragStartHour, dragHoverHour);
    const hours = new Set<number>();
    for (let h = lo; h <= hi; h++) hours.add(h);
    return hours;
  }, [dragStartHour, dragHoverHour]);

  const effectiveHighlight = previewHours ?? activeHours;

  const commitRange = useCallback(
    (a: number, b: number) => {
      const startH = Math.min(a, b);
      const endHourInclusive = Math.max(a, b);
      const start = startH * 60;
      const end = ((endHourInclusive + 1) % 24) * 60 || 24 * 60;
      onSelectRange(start, end === 0 ? 24 * 60 : end);
    },
    [onSelectRange],
  );

  function handlePointerDown(hour: number) {
    setDragStartHour(hour);
    setDragHoverHour(hour);
  }
  function handlePointerEnter(hour: number) {
    if (dragStartHour == null) return;
    setDragHoverHour(hour);
  }
  function handlePointerUp() {
    if (dragStartHour != null && dragHoverHour != null) {
      commitRange(dragStartHour, dragHoverHour);
    }
    setDragStartHour(null);
    setDragHoverHour(null);
  }

  return (
    <div className={cn("space-y-2", className)} data-testid="crime-clock-histogram">
      <p className="text-xs font-medium text-muted">{t("di.temporal.histogramTitle")}</p>
      <div
        ref={containerRef}
        className="grid grid-flow-col auto-cols-fr gap-0.5 overflow-x-auto"
        role="group"
        aria-label={t("di.temporal.histogramTitle")}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (dragStartHour == null) return;
          if (dragHoverHour != null) commitRange(dragStartHour, dragHoverHour);
          setDragStartHour(null);
          setDragHoverHour(null);
        }}
      >
        {hourlyDistribution.map((bucket) => {
          const isSelected = effectiveHighlight?.has(bucket.hour) ?? false;
          const heightPct = bucket.count === 0 ? 4 : 12 + 88 * (bucket.count / maxCount);
          const hourLabel = `${String(bucket.hour).padStart(2, "0")}:00`;
          const hourEndLabel = `${String(bucket.hour).padStart(2, "0")}:59`;
          const accessibleLabel =
            t("di.temporal.hourAccessibleLabel")
              .replace("{start}", hourLabel)
              .replace("{end}", hourEndLabel)
              .replace("{count}", String(bucket.count)) + (isSelected ? ` — ${t("di.temporal.hourSelectedSuffix")}` : "");
          return (
            <button
              key={bucket.hour}
              type="button"
              // V1.5B selection-readability polish: selection is now a
              // single thin border UNDER the bar column (spans every
              // selected hour as one continuous line, same idea as the
              // clock's single outer arc) plus a very soft background
              // tint — never a full ring drawn around each individual
              // bar, which for a broad range reads as a grid of borders
              // competing with the frequency bars themselves.
              className={cn(
                "flex min-w-[22px] flex-col items-center gap-1 rounded-sm px-0.5 pt-1 pb-1 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                isSelected ? "border-foreground bg-accent/5" : "border-transparent hover:bg-neutral-bg",
              )}
              aria-label={accessibleLabel}
              aria-pressed={isSelected}
              data-testid={`crime-clock-histogram-bar-${bucket.hour}`}
              data-hour={bucket.hour}
              data-count={bucket.count}
              data-selected={isSelected ? "true" : "false"}
              onPointerDown={() => handlePointerDown(bucket.hour)}
              onPointerEnter={() => handlePointerEnter(bucket.hour)}
              onClick={() => {
                if (dragStartHour == null) commitRange(bucket.hour, bucket.hour);
              }}
              title={`${hourLabel}–${hourEndLabel} น. · ${bucket.count} คดี`}
            >
              <span className="text-[10px] font-medium text-foreground">{bucket.count > 0 ? bucket.count : ""}</span>
              <span className="flex h-16 w-full items-end">
                <span
                  className={cn("w-full rounded-sm bg-accent transition-[height]", bucket.count === 0 && "bg-border")}
                  style={{ height: `${heightPct}%`, opacity: bucket.count === 0 ? 1 : 0.35 + 0.55 * (bucket.count / maxCount) }}
                />
              </span>
              <span className="text-[9px] text-muted">{String(bucket.hour).padStart(2, "0")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
