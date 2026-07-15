"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
} from "@/lib/officer_profile/thai_date";
import { cn } from "@/lib/ui/cn";

/** Personnel birth dates typically fall in this Buddhist-Era range. */
export const THAI_PERSONNEL_YEAR_BE_MIN = 2500;
export const THAI_PERSONNEL_YEAR_BE_MAX = 2575;

export interface ThaiDatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rejectFuture?: boolean;
  "aria-label"?: string;
  className?: string;
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

function buildYearOptions(): number[] {
  const years: number[] = [];
  for (let year = THAI_PERSONNEL_YEAR_BE_MAX; year >= THAI_PERSONNEL_YEAR_BE_MIN; year -= 1) {
    years.push(year);
  }
  return years;
}

const YEAR_OPTIONS = buildYearOptions();

function validateParts(day: number, month: number, yearBE: number, rejectFuture: boolean): string | null {
  if (!isValidDay(day) || !isValidMonth(month) || !isValidYearBE(yearBE)) return "วันที่ไม่ถูกต้อง";
  if (day > daysInMonth(yearBE, month)) return "วันที่ไม่ถูกต้อง";
  const date = new Date(Date.UTC(yearBEToGregorian(yearBE), month - 1, day));
  if (rejectFuture && isFutureDate(date)) return "ไม่สามารถเลือกวันที่ในอนาคตได้";
  return null;
}

function commitDate(day: number, month: number, yearBE: number, rejectFuture: boolean): { value: string } | { error: string } {
  const validationError = validateParts(day, month, yearBE, rejectFuture);
  if (validationError) return { error: validationError };
  const date = new Date(Date.UTC(yearBEToGregorian(yearBE), month - 1, day));
  return { value: formatThaiPersonnelDate(date) };
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
}: ThaiDatePickerProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const rootRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => parseThaiPersonnelDate(value), [value]);
  const today = new Date();
  const defaultYear = yearGregorianToBE(today.getUTCFullYear());

  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(parsed?.getUTCDate() ?? 1);
  const [month, setMonth] = useState(parsed?.getUTCMonth() ? parsed.getUTCMonth() + 1 : today.getUTCMonth() + 1);
  const [yearBE, setYearBE] = useState(parsed ? parsed.getUTCFullYear() + 543 : defaultYear);
  const [showYearGrid, setShowYearGrid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed) return;
    setDay(parsed.getUTCDate());
    setMonth(parsed.getUTCMonth() + 1);
    setYearBE(parsed.getUTCFullYear() + 543);
  }, [parsed]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setShowYearGrid(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setShowYearGrid(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const monthDays = daysInMonth(yearBE, month);
  const safeDay = Math.min(day, monthDays);

  function applySelection(nextDay: number, nextMonth: number, nextYearBE: number, close = false) {
    const result = commitDate(nextDay, nextMonth, nextYearBE, rejectFuture);
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

  const displayValue = value || placeholder;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
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

      {open ? (
        <div
          role="dialog"
          aria-label="เลือกวันที่ พ.ศ."
          className="absolute z-50 mt-2 w-full min-w-80 rounded-xl border border-border bg-surface p-3 shadow-lg"
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
                {YEAR_OPTIONS.map((optionYear) => (
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
            <button type="button" className="text-xs text-muted hover:text-foreground" onClick={clearValue}>
              ล้าง
            </button>
          </div>

          {showYearGrid ? (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
              <div className="grid grid-cols-4 gap-1">
                {YEAR_OPTIONS.map((optionYear) => (
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
              const selected = parsed && parsed.getUTCDate() === optionDay && parsed.getUTCMonth() + 1 === month && parsed.getUTCFullYear() + 543 === yearBE;
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
                    selected && "bg-accent text-white hover:bg-accent"
                  )}
                  aria-label={`${optionDay} ${THAI_MONTHS[month]} ${yearBE}`}
                >
                  {optionDay}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-1 text-xs text-serious">{error}</p> : null}
    </div>
  );
}
