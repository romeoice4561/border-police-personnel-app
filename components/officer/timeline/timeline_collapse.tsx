/**
 * TimelineCollapse (Phase 45 — Timeline Workspace UX, Part 3).
 *
 * An accessible expand/collapse toggle for a Timeline card. Real <button> with
 * aria-expanded + aria-controls, keyboard-operable. When `forcedOpen` (the
 * current-position row must stay expanded), the control is rendered disabled
 * and always shows the expanded state — the parent guarantees it's open.
 */
"use client";

import { ChevronDown } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";

export function TimelineCollapse({
  expanded,
  forcedOpen,
  controls,
  onToggle,
}: {
  expanded: boolean;
  forcedOpen?: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={forcedOpen ? undefined : onToggle}
      disabled={forcedOpen}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={expanded ? t("timeline.collapse") : t("timeline.expand")}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        forcedOpen ? "cursor-default opacity-40" : "hover:bg-neutral-bg hover:text-foreground"
      )}
    >
      <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
    </button>
  );
}
