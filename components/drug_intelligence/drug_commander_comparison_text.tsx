/**
 * Neutral period-comparison copy. Direction is text-only — no red/green.
 */
"use client";

import type { CommanderDeltaCopy } from "@/lib/drug_intelligence/drug_commander_comparison";
import { cn } from "@/lib/ui/cn";

interface Props {
  copy: CommanderDeltaCopy;
  previousLabel: string;
  className?: string;
}

export function CommanderComparisonText({ copy, previousLabel, className }: Props) {
  return (
    <div className={cn("mt-2 space-y-0.5 text-xs text-muted", className)}>
      <p>{copy.changeText}</p>
      <p>
        <span className="tabular-nums">{copy.percentText}</span>
        <span className="sr-only"> {previousLabel}</span>
      </p>
    </div>
  );
}
