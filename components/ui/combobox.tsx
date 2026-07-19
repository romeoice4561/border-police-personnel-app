/**
 * Combobox primitive (Phase 23A UI).
 *
 * A free-text input with a suggestion dropdown — for fields like Unit
 * (Section 2) where existing values should be selectable but the user must
 * ALSO be able to type a brand-new value (never a forced/closed dropdown).
 * Dependency-free (no Radix/cmdk) — a plain text input plus an absolutely
 * positioned suggestion list, filtered client-side as the user types.
 *
 * Keyboard: Up/Down moves the highlighted suggestion, Enter selects it (or
 * just commits the typed text if none is highlighted), Escape closes the
 * list without changing the value.
 */
"use client";

import { useEffect, useId, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent } from "react";
import { cn } from "@/lib/ui/cn";

export interface ComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Known existing values to suggest — the user is never limited to only these. */
  suggestions: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  "aria-label"?: string;
}

const MAX_SUGGESTIONS = 8;

export function Combobox({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  disabled,
  className,
  inputMode,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const filtered = useMemo(() => {
    const needle = value.trim().toLowerCase();
    const pool = needle.length === 0 ? suggestions : suggestions.filter((s) => s.toLowerCase().includes(needle));
    // Never suggest the exact current value as a redundant option.
    return pool.filter((s) => s !== value).slice(0, MAX_SUGGESTIONS);
  }, [suggestions, value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSuggestion(suggestion: string) {
    onChange(suggestion);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      selectSuggestion(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        className={cn(
          "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && filtered.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {filtered.map((suggestion, i) => (
            <li key={suggestion} role="option" aria-selected={i === highlighted}>
              <button
                type="button"
                className={cn(
                  "block w-full truncate px-3 py-1.5 text-left text-sm text-foreground hover:bg-neutral-bg",
                  i === highlighted && "bg-neutral-bg"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
