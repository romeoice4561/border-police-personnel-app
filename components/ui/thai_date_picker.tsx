"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import {
  formatThaiPersonnelDate,
  parseThaiPersonnelDate,
} from "@/lib/officer_profile/thai_personnel_date";
import {
  THAI_MONTHS,
  isValidDay,
  isValidMonth,
  isValidYearBE,
  yearBEToGregorian,
  yearGregorianToBE,
  currentYearBE,
} from "@/lib/officer_profile/thai_date";
import { computePopoverPlacement, type PopoverPlacement } from "@/lib/ui/popover_placement";
import { cn } from "@/lib/ui/cn";

/** Fixed popover size assumed for placement math — matches the panel's own min/max width (min-w-80 = 320px) and its typical rendered height with the year grid closed. Recalculated live via ref measurement once mounted (see PICKER_HEIGHT_FALLBACK usage below), this is only the FIRST-PAINT estimate before a real measurement exists. */
const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT_ESTIMATE = 360;

/** Personnel birth dates typically fall in this Buddhist-Era range (the default range — pass `yearRangeBE` to override for other use cases, e.g. document expiry). */
export const THAI_PERSONNEL_YEAR_BE_MIN = 2500;
export const THAI_PERSONNEL_YEAR_BE_MAX = 2575;

/**
 * Phase 47A — a document expiry date can be any number of years in the
 * future (a 10-year professional license, etc.), so this range is wider on
 * the future side than the birth-date default above.
 */
export const THAI_EXPIRY_YEAR_BE_MIN = 2480;
export const THAI_EXPIRY_YEAR_BE_MAX = 2620;

export interface ThaiDatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rejectFuture?: boolean;
  "aria-label"?: string;
  className?: string;
  /**
   * "thai" (default, unchanged from before this phase) — value/onChange
   * carry a DD/MM/YYYY(BE) string, matching every existing call site
   * (birth date, etc.).
   * "iso" (Phase 47A — Document Expiry date fields) — value/onChange carry
   * a plain ISO "yyyy-mm-dd" string, matching what the API/database already
   * store. The picker itself always DISPLAYS DD/MM/YYYY (พ.ศ.) and always
   * lets the user pick via Thai month/Buddhist-Era year — only the
   * value/onChange wire format differs. Conversion happens only in this
   * component; nothing upstream ever sees a Gregorian-year string.
   */
  outputFormat?: "thai" | "iso";
  /** Overrides the selectable Buddhist-Era year range. Defaults to the birth-date range for backward compatibility. */
  yearRangeBE?: { min: number; max: number };
  /** Shows a "Today"/"วันนี้" quick-select button in the footer (Phase 47A). */
  showTodayButton?: boolean;
}

const selectCls =
  "w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function daysInMonth(yearBE: number, month: number): number {
  const yearCE = yearBEToGregorian(yearBE);
  return new Date(Date.UTC(yearCE, month, 0)).getUTCDate();
}

function isFutureDate(date: Date): boolean {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const valueUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return valueUtc > todayUtc;
}

function buildYearOptions(minBE: number, maxBE: number): number[] {
  const years: number[] = [];
  for (let year = maxBE; year >= minBE; year -= 1) {
    years.push(year);
  }
  return years;
}

function validateParts(day: number, month: number, yearBE: number, rejectFuture: boolean): string | null {
  if (!isValidDay(day) || !isValidMonth(month) || !isValidYearBE(yearBE)) return "วันที่ไม่ถูกต้อง";
  if (day > daysInMonth(yearBE, month)) return "วันที่ไม่ถูกต้อง";
  const date = new Date(Date.UTC(yearBEToGregorian(yearBE), month - 1, day));
  if (rejectFuture && isFutureDate(date)) return "ไม่สามารถเลือกวันที่ในอนาคตได้";
  return null;
}

/** Parses either wire format (Thai DD/MM/YYYY-BE or ISO yyyy-mm-dd) into a UTC Date — parseThaiPersonnelDate already understands both. */
function parseValue(value: string): Date | null {
  return parseThaiPersonnelDate(value);
}

function formatOutput(date: Date, outputFormat: "thai" | "iso"): string {
  if (outputFormat === "iso") return date.toISOString().slice(0, 10);
  return formatThaiPersonnelDate(date);
}

function commitDate(
  day: number,
  month: number,
  yearBE: number,
  rejectFuture: boolean,
  outputFormat: "thai" | "iso"
): { value: string } | { error: string } {
  const validationError = validateParts(day, month, yearBE, rejectFuture);
  if (validationError) return { error: validationError };
  const date = new Date(Date.UTC(yearBEToGregorian(yearBE), month - 1, day));
  return { value: formatOutput(date, outputFormat) };
}

export function ThaiDatePicker({
  id,
  value,
  onChange,
  placeholder = "เลือกวันที่ (พ.ศ.)",
  disabled = false,
  rejectFuture = false,
  "aria-label": ariaLabel,
  className,
  outputFormat = "thai",
  yearRangeBE = { min: THAI_PERSONNEL_YEAR_BE_MIN, max: THAI_PERSONNEL_YEAR_BE_MAX },
  showTodayButton = false,
}: ThaiDatePickerProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
  const parsed = useMemo(() => parseValue(value), [value]);
  const today = new Date();
  const defaultYear = yearGregorianToBE(today.getUTCFullYear());
  const yearOptions = useMemo(() => buildYearOptions(yearRangeBE.min, yearRangeBE.max), [yearRangeBE.min, yearRangeBE.max]);

  const [open, setOpen] = useState(false);
  const [showYearGrid, setShowYearGrid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive day/month/yearBE straight from the `value` prop during render
  // (React's "derive state from props" pattern) instead of a useEffect —
  // avoids the setState-in-effect cascade the previous version had, and
  // keeps the displayed selection always in sync with the parsed value with
  // no extra render pass.
  const [lastSeenValue, setLastSeenValue] = useState(value);
  const [day, setDay] = useState(parsed?.getUTCDate() ?? 1);
  const [month, setMonth] = useState(parsed ? parsed.getUTCMonth() + 1 : today.getUTCMonth() + 1);
  const [yearBE, setYearBE] = useState(parsed ? yearGregorianToBE(parsed.getUTCFullYear()) : defaultYear);
  if (value !== lastSeenValue) {
    setLastSeenValue(value);
    const nextParsed = parseValue(value);
    setDay(nextParsed?.getUTCDate() ?? 1);
    setMonth(nextParsed ? nextParsed.getUTCMonth() + 1 : today.getUTCMonth() + 1);
    setYearBE(nextParsed ? yearGregorianToBE(nextParsed.getUTCFullYear()) : defaultYear);
  }

  // Escape-to-close and click-outside-to-close, attached only while open.
  // This effect only subscribes/unsubscribes DOM listeners — it never calls
  // setState synchronously on mount, so it doesn't trigger the
  // react-hooks/set-state-in-effect rule the old value-sync effect did.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      // The popover is portaled to document.body (Phase 47B), so it's no
      // longer a DOM descendant of rootRef — a click inside it must also
      // count as "inside" or every click on a day/month/year control would
      // incorrectly be treated as a click-outside and close the picker.
      const clickedInsideTrigger = rootRef.current?.contains(target) ?? false;
      const clickedInsidePopover = popoverRef.current?.contains(target) ?? false;
      if (!clickedInsideTrigger && !clickedInsidePopover) {
        setOpen(false);
        setShowYearGrid(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // Captured (not bubble phase) so this fires BEFORE an ancestor
        // dialog/drawer's own document-level Escape listener (e.g. the e-PF
        // Detail Drawer, components/ui/drawer.tsx) — capture-phase listeners
        // always run before bubble-phase ones regardless of registration
        // order, so registering here with `capture: true` reliably wins
        // even though the Drawer opened (and attached its listener) first.
        // stopPropagation then prevents that ancestor listener from ever
        // running for this keystroke, so Escape closes only the popover
        // that's actually open, one level at a time.
        event.stopPropagation();
        setOpen(false);
        setShowYearGrid(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [open]);

  // Collision-aware placement (Phase 47B — the previously-reported bug: a
  // trigger near the right edge of the e-PF Detail Drawer, e.g. Renewal
  // Date, produced a popover that opened off-screen to the right). The
  // popover is portaled to document.body and positioned with `position:
  // fixed`, so it is never clipped by an `overflow-hidden`/`overflow-auto`
  // ancestor (the drawer's own scroll container) and never widens the
  // drawer. Recalculated on open, window resize, and scroll of ANY
  // scrollable ancestor (capture-phase scroll listener catches scrolling on
  // the drawer's inner container, not just window scroll) — per spec §1/§3,
  // "prefer repositioning while the picker remains open" over closing it.
  useEffect(() => {
    if (!open) return;

    function recalculate() {
      const triggerEl = triggerRef.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const measuredHeight = popoverRef.current?.offsetHeight ?? POPOVER_HEIGHT_ESTIMATE;
      const next = computePopoverPlacement(
        { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        { width: POPOVER_WIDTH, height: measuredHeight },
        { width: window.innerWidth, height: window.innerHeight }
      );
      setPlacement(next);
    }

    recalculate();
    window.addEventListener("resize", recalculate);
    // capture: true so this also catches scroll events on inner scrollable
    // containers (e.g. the Detail Drawer's own overflow-y-auto panel),
    // which don't bubble to window in the "scroll" event's normal phase.
    window.addEventListener("scroll", recalculate, { capture: true });
    return () => {
      window.removeEventListener("resize", recalculate);
      window.removeEventListener("scroll", recalculate, { capture: true });
    };
    // Re-runs when showYearGrid toggles too — the year-grid panel changes
    // the popover's rendered height, so placement must be recalculated.
  }, [open, showYearGrid]);

  const monthDays = daysInMonth(yearBE, month);
  const safeDay = Math.min(day, monthDays);

  function applySelection(nextDay: number, nextMonth: number, nextYearBE: number, close = false) {
    const result = commitDate(nextDay, nextMonth, nextYearBE, rejectFuture, outputFormat);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange(result.value);
    if (close) {
      setOpen(false);
      setShowYearGrid(false);
    }
  }

  function clearValue() {
    setError(null);
    onChange("");
    setOpen(false);
    setShowYearGrid(false);
  }

  function selectToday() {
    const now = new Date();
    const todayDay = now.getUTCDate();
    const todayMonth = now.getUTCMonth() + 1;
    const todayYearBE = yearGregorianToBE(now.getUTCFullYear());
    setDay(todayDay);
    setMonth(todayMonth);
    setYearBE(todayYearBE);
    applySelection(todayDay, todayMonth, todayYearBE, true);
  }

  const displayValue = value ? formatThaiPersonnelDate(parsed) || placeholder : placeholder;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? "Thai date picker"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          disabled && "cursor-not-allowed opacity-50",
          !value && "text-muted"
        )}
      >
        <span>{displayValue}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="เลือกวันที่ พ.ศ."
              className="fixed z-50 w-80 max-w-[calc(100vw-16px)] rounded-xl border border-border bg-surface p-3 shadow-lg"
              style={{
                // Positioned via lib/ui/popover_placement.ts (collision-aware
                // fixed coordinates). Until the first measurement completes
                // (placement is null for one paint), render off-screen
                // rather than at a wrong/flashing position.
                top: placement?.top ?? -9999,
                left: placement?.left ?? -9999,
                visibility: placement ? "visible" : "hidden",
              }}
            >
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1 text-[11px] font-medium text-muted">
                  วัน / Day
                  <select
                    className={selectCls}
                    value={safeDay}
                    onChange={(e) => {
                      const nextDay = Number(e.target.value);
                      setDay(nextDay);
                      applySelection(nextDay, month, yearBE);
                    }}
                    aria-label="วัน"
                  >
                    {Array.from({ length: monthDays }, (_, index) => index + 1).map((optionDay) => (
                      <option key={optionDay} value={optionDay}>{optionDay}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-[11px] font-medium text-muted">
                  เดือน / Month
                  <select
                    className={selectCls}
                    value={month}
                    onChange={(e) => {
                      const nextMonth = Number(e.target.value);
                      const nextDay = Math.min(safeDay, daysInMonth(yearBE, nextMonth));
                      setMonth(nextMonth);
                      setDay(nextDay);
                      applySelection(nextDay, nextMonth, yearBE);
                    }}
                    aria-label="เดือน"
                  >
                    {THAI_MONTHS.slice(1).map((label, index) => (
                      <option key={label} value={index + 1}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-[11px] font-medium text-muted">
                  ปี พ.ศ. / Year
                  <select
                    className={selectCls}
                    value={yearBE}
                    onChange={(e) => {
                      const nextYear = Number(e.target.value);
                      const nextDay = Math.min(safeDay, daysInMonth(nextYear, month));
                      setYearBE(nextYear);
                      setDay(nextDay);
                      applySelection(nextDay, month, nextYear);
                    }}
                    aria-label="ปี พ.ศ."
                  >
                    {yearOptions.map((optionYear) => (
                      <option key={optionYear} value={optionYear}>{optionYear}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <button
                  type="button"
                  className="text-xs font-medium text-accent hover:underline"
                  onClick={() => setShowYearGrid((current) => !current)}
                  aria-expanded={showYearGrid}
                >
                  {yearBE} (พ.ศ.) — เลือกปี
                </button>
                <div className="flex items-center gap-3">
                  {showTodayButton ? (
                    <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={selectToday}>
                      วันนี้
                    </button>
                  ) : null}
                  <button type="button" className="text-xs text-muted hover:text-foreground" onClick={clearValue}>
                    ล้าง
                  </button>
                </div>
              </div>

              {showYearGrid ? (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                  <div className="grid grid-cols-4 gap-1">
                    {yearOptions.map((optionYear) => (
                      <button
                        key={optionYear}
                        type="button"
                        onClick={() => {
                          const nextDay = Math.min(safeDay, daysInMonth(optionYear, month));
                          setYearBE(optionYear);
                          setDay(nextDay);
                          setShowYearGrid(false);
                          applySelection(nextDay, month, optionYear);
                        }}
                        className={cn(
                          "rounded-md px-2 py-1.5 text-xs hover:bg-accent/10",
                          optionYear === yearBE && "bg-accent text-white hover:bg-accent"
                        )}
                      >
                        {optionYear}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
                {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((label) => (
                  <div key={label} className="py-1 font-medium">{label}</div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: (new Date(Date.UTC(yearBEToGregorian(yearBE), month - 1, 1)).getUTCDay() + 6) % 7 }, (_, index) => (
                  <div key={`blank-${index}`} />
                ))}
                {Array.from({ length: monthDays }, (_, index) => {
                  const optionDay = index + 1;
                  const selected = parsed && parsed.getUTCDate() === optionDay && parsed.getUTCMonth() + 1 === month && yearGregorianToBE(parsed.getUTCFullYear()) === yearBE;
                  const isToday =
                    optionDay === today.getUTCDate() && month === today.getUTCMonth() + 1 && yearBE === currentYearBE(today);
                  return (
                    <button
                      key={optionDay}
                      type="button"
                      onClick={() => {
                        setDay(optionDay);
                        applySelection(optionDay, month, yearBE, true);
                      }}
                      className={cn(
                        "rounded-md py-2 text-sm hover:bg-accent/10",
                        selected && "bg-accent text-white hover:bg-accent",
                        !selected && isToday && "ring-1 ring-accent"
                      )}
                      aria-label={`${optionDay} ${THAI_MONTHS[month]} ${yearBE}`}
                    >
                      {optionDay}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}

      {error ? <p className="mt-1 text-xs text-serious">{error}</p> : null}
    </div>
  );
}
