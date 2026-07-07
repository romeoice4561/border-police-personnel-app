/**
 * Select primitive (Phase 23A UI).
 *
 * A styled wrapper over the native `<select>` — dependency-free (no Radix),
 * matching this codebase's precedent of using the browser's own control
 * dressed with Tailwind (see GalleryEditModal's inline `<select>`), but
 * extracted into one reusable component so every dropdown in the app (rank,
 * year, timeline source/status, ...) shares the same look and behavior
 * instead of repeating the class string.
 */
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: readonly SelectOption[];
  /** Placeholder shown as the first, empty-value option (e.g. "– ไม่ระบุ –"). Omit to force a real selection. */
  placeholder?: string;
}

export function Select({ options, placeholder, className, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          "w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-9 text-sm text-foreground",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
}
