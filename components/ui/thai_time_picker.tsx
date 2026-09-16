/**
 * Compact Thai arrest-time picker.
 *
 * Field officers tap +/- or type two digits; they never scroll a native
 * 00–23 native hour dropdown. Minutes step by 5 with a compact 5-minute grid, while
 * the typed value can still be any valid HH:mm.
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  commitThaiTimeParts,
  parseThaiTime,
  stepThaiTimeHour,
  stepThaiTimeMinute,
  THAI_TIME_HOURS,
  THAI_TIME_MINUTE_STEP,
  THAI_TIME_QUICK_MINUTES,
} from "@/lib/drug_intelligence/thai_time";
import { cn } from "@/lib/ui/cn";

export function ThaiTimePicker({
  id,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const { hour, minute } = parseThaiTime(value);
  const [openPanel, setOpenPanel] = useState<"hour" | "minute" | null>(null);
  const [editing, setEditing] = useState<"hour" | "minute" | null>(null);
  const [hourDraft, setHourDraft] = useState("");
  const [minuteDraft, setMinuteDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const hourListId = useId();
  const minuteListId = useId();

  const hourDisplay = editing === "hour" ? hourDraft : hour;
  const minuteDisplay = editing === "minute" ? minuteDraft : minute;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function commitDrafts(nextHour: string, nextMinute: string) {
    onChange(commitThaiTimeParts(nextHour, nextMinute));
    setEditing(null);
  }

  const display = hour && minute ? `${hour}:${minute} น.` : "";

  return (
    <div ref={rootRef} className="space-y-2" aria-label={ariaLabel}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <TimeDigitColumn
          id={id}
          label="ชั่วโมง"
          value={hourDisplay}
          placeholder="--"
          disabled={disabled}
          open={openPanel === "hour"}
          listId={hourListId}
          onStep={(delta) => onChange(stepThaiTimeHour(value, delta))}
          onFocus={() => {
            setEditing("hour");
            setHourDraft(hour);
          }}
          onTypedChange={setHourDraft}
          onTypedCommit={() => commitDrafts(hourDraft, minuteDraft || minute || "00")}
          onToggleGrid={() => setOpenPanel((panel) => (panel === "hour" ? null : "hour"))}
        />
        <span className="text-xl font-semibold text-foreground" aria-hidden="true">
          :
        </span>
        <TimeDigitColumn
          label="นาที"
          value={minuteDisplay}
          placeholder="--"
          disabled={disabled}
          open={openPanel === "minute"}
          listId={minuteListId}
          onStep={(delta) => onChange(stepThaiTimeMinute(value, delta * THAI_TIME_MINUTE_STEP))}
          onFocus={() => {
            setEditing("minute");
            setMinuteDraft(minute);
          }}
          onTypedChange={setMinuteDraft}
          onTypedCommit={() => commitDrafts(hourDraft || hour || "09", minuteDraft)}
          onToggleGrid={() => setOpenPanel((panel) => (panel === "minute" ? null : "minute"))}
        />
        <span className="text-sm font-medium text-muted">น.</span>
        <button
          type="button"
          disabled={disabled || (!hour && !minute)}
          onClick={() => {
            onChange("");
            setOpenPanel(null);
            setEditing(null);
            setHourDraft("");
            setMinuteDraft("");
          }}
          className={cn(
            "rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-surface hover:text-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          ล้างเวลา
        </button>
      </div>

      {openPanel === "hour" ? (
        <div id={hourListId} role="listbox" aria-label="เลือกชั่วโมง" className="grid grid-cols-6 gap-1 rounded-lg border border-border bg-surface p-2">
          {THAI_TIME_HOURS.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === hour}
              className={cn(
                "rounded-md px-1 py-1.5 text-sm tabular-nums hover:bg-neutral-bg",
                option === hour ? "bg-accent text-accent-fg" : "text-foreground"
              )}
              onClick={() => {
                onChange(commitThaiTimeParts(option, minute || "00"));
                setOpenPanel(null);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}

      {openPanel === "minute" ? (
        <div id={minuteListId} role="listbox" aria-label="เลือกนาที" className="grid grid-cols-6 gap-1 rounded-lg border border-border bg-surface p-2">
          {THAI_TIME_QUICK_MINUTES.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === minute}
              className={cn(
                "rounded-md px-1 py-1.5 text-sm tabular-nums hover:bg-neutral-bg",
                option === minute ? "bg-accent text-accent-fg" : "text-foreground"
              )}
              onClick={() => {
                onChange(commitThaiTimeParts(hour || "09", option));
                setOpenPanel(null);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}

      {display ? <p className="text-xs text-muted">เวลาที่เลือก: {display}</p> : <p className="text-xs text-muted">ไม่บังคับ — กด +/− หรือพิมพ์ชั่วโมงและนาที หรือเว้นว่าง</p>}
    </div>
  );
}

function TimeDigitColumn({
  id,
  label,
  value,
  placeholder,
  disabled,
  open,
  listId,
  onStep,
  onFocus,
  onTypedChange,
  onTypedCommit,
  onToggleGrid,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  open: boolean;
  listId: string;
  onStep: (delta: 1 | -1) => void;
  onFocus: () => void;
  onTypedChange: (value: string) => void;
  onTypedCommit: () => void;
  onToggleGrid: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label={`เพิ่ม${label}`}
        disabled={disabled}
        onClick={() => onStep(1)}
        className="rounded-md p-1 text-muted hover:bg-surface hover:text-foreground disabled:opacity-50"
      >
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        id={id}
        inputMode="numeric"
        maxLength={2}
        aria-label={label}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onFocus={onFocus}
        onChange={(e) => onTypedChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={onTypedCommit}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onStep(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onStep(-1);
          } else if (e.key === "Enter") {
            e.preventDefault();
            onTypedCommit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            if (open) onToggleGrid();
          }
        }}
        className="w-14 rounded-lg border border-border bg-background px-2 py-2 text-center text-lg font-semibold tabular-nums text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
      />
      <button
        type="button"
        aria-label={`ลด${label}`}
        disabled={disabled}
        onClick={() => onStep(-1)}
        className="rounded-md p-1 text-muted hover:bg-surface hover:text-foreground disabled:opacity-50"
      >
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggleGrid}
        className="text-[11px] text-accent hover:underline disabled:opacity-50"
      >
        เลือก
      </button>
    </div>
  );
}
