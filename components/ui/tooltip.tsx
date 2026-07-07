/**
 * Tooltip primitive (Phase 21A UI).
 *
 * A minimal, dependency-free tooltip: a native `title` attribute (works
 * everywhere with zero JS, including screen readers via the accessible name)
 * plus a small CSS-only visual bubble on hover/focus for sighted users. No new
 * package — Phase 18A's precedent is to avoid adding a dependency unless truly
 * necessary, and a hover/focus label doesn't need one.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)} title={label}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-surface opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
