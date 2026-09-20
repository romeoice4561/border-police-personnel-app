/**
 * Compact Thai 24-hour time picker.
 *
 * Shared by Create Case (inline) and Map custom time filters (popover).
 * Minutes expose 5-minute quick steps; typed/existing off-step values
 * (e.g. 21:37) are preserved and never silently rounded.
 */
"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  commitThaiTimeParts,
  createThaiTimeDraftFromValue,
  formatThaiTimeDraftPreview,
  parseThaiTime,
  resolveThaiTimeDraftCommit,
  stepThaiTimeDraftOption,
  stepThaiTimeHour,
  stepThaiTimeMinute,
  thaiTimeMinuteOptionsFor,
  THAI_TIME_HOURS,
  THAI_TIME_MINUTE_STEP,
  THAI_TIME_QUICK_MINUTES,
  type ThaiTimeDraft,
} from "@/lib/drug_intelligence/thai_time";
import { cn } from "@/lib/ui/cn";

export function ThaiTimePicker({
  id,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  variant = "inline",
  placeholder = "--:-- น.",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
  /** inline = create-case digit columns; popover = compact trigger + wheel popover */
  variant?: "inline" | "popover";
  placeholder?: string;
}) {
  if (variant === "popover") {
    return (
      <ThaiTimePopoverPicker
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
      />
    );
  }
  return (
    <ThaiTimeInlinePicker id={id} value={value} onChange={onChange} disabled={disabled} aria-label={ariaLabel} />
  );
}

function ThaiTimeInlinePicker({
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
  const minuteChoices = thaiTimeMinuteOptionsFor(minute);

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
          {minuteChoices.map((option) => (
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

function ThaiTimePopoverPicker({
  id,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
  placeholder: string;
}) {
  const committed = parseThaiTime(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ThaiTimeDraft>(() => createThaiTimeDraftFromValue(value));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const minuteChoices = thaiTimeMinuteOptionsFor(draft.minute);
  const draftPreview = formatThaiTimeDraftPreview(draft);
  const canConfirm = resolveThaiTimeDraftCommit(draft, "confirm") != null;

  function openPopover() {
    setDraft(createThaiTimeDraftFromValue(value));
    setOpen(true);
  }

  function closeDiscard() {
    setDraft(createThaiTimeDraftFromValue(value));
    setOpen(false);
  }

  function confirmDraft() {
    const next = resolveThaiTimeDraftCommit(draft, "confirm");
    if (next == null) return;
    // Only notify parent once — Map filter uses window.location.assign.
    if (next !== value) onChange(next);
    setOpen(false);
  }

  function clearAndCommit() {
    if (value !== "") onChange("");
    setDraft({ hour: "", minute: "" });
    setOpen(false);
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 240;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 320);
    setCoords({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDraft(createThaiTimeDraftFromValue(value));
        setOpen(false);
      }
    }
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setDraft(createThaiTimeDraftFromValue(value));
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, value]);

  const triggerLabel = committed.hour && committed.minute ? `${committed.hour}:${committed.minute} น.` : placeholder;

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? closeDiscard() : openPopover())}
        className={cn(
          "flex w-full min-h-10 items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm tabular-nums",
          "hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          committed.hour && committed.minute ? "text-foreground" : "text-muted"
        )}
      >
        <span>{triggerLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={ariaLabel ?? "เลือกเวลา"}
              data-testid="thai-time-popover"
              className="fixed z-[80] w-[240px] rounded-xl border border-border bg-surface p-2.5 shadow-lg"
              style={{ top: coords.top, left: coords.left }}
            >
              <div className="mb-2 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">เวลาที่เลือก</p>
                <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground" data-testid="thai-time-draft-preview">
                  {draftPreview ?? "—:— น."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <WheelColumn
                  label="ชั่วโมง"
                  options={THAI_TIME_HOURS}
                  selected={draft.hour}
                  onSelect={(h) => setDraft((d) => ({ ...d, hour: h }))}
                />
                <WheelColumn
                  label="นาที"
                  options={minuteChoices}
                  selected={draft.minute}
                  onSelect={(m) => setDraft((d) => ({ ...d, minute: m }))}
                />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  data-testid="thai-time-clear"
                  className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-muted hover:bg-neutral-bg hover:text-foreground"
                  onClick={clearAndCommit}
                >
                  ล้าง
                </button>
                <button
                  type="button"
                  data-testid="thai-time-confirm"
                  disabled={!canConfirm}
                  className="flex-1 rounded-lg bg-accent px-2 py-1.5 text-xs font-medium text-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={confirmDraft}
                >
                  ตกลง
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function WheelColumn({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const didInitialScroll = useRef(false);

  useLayoutEffect(() => {
    // Center the committed/initial selection once — not on every wheel step
    // (scrollIntoView-per-step fought overflow scroll and remounted parents).
    if (didInitialScroll.current) return;
    if (!selected) return;
    selectedRef.current?.scrollIntoView({ block: "center" });
    didInitialScroll.current = true;
  }, [selected]);

  function step(delta: 1 | -1) {
    const next = stepThaiTimeDraftOption(options, selected, delta);
    if (next && next !== selected) onSelect(next);
  }

  return (
    <div className="min-w-0">
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          step(e.deltaY > 0 ? 1 : -1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            step(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            step(-1);
          }
        }}
        className="h-36 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background py-1 [scrollbar-width:thin]"
      >
        {options.map((option) => {
          const active = option === selected;
          return (
            <button
              key={option}
              ref={active ? selectedRef : undefined}
              type="button"
              role="option"
              aria-selected={active}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(option);
              }}
              className={cn(
                "flex w-full items-center justify-center px-2 py-1.5 text-sm tabular-nums",
                active ? "bg-accent font-semibold text-accent-fg" : "text-foreground hover:bg-neutral-bg"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
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
