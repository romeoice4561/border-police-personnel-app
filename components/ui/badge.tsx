/**
 * Badge primitive (Phase 14 UI).
 *
 * A small labeled pill. The `tone` variants use the RESERVED status colors
 * (good/warning/serious/critical/neutral) — always with a text label, never
 * color alone — plus a plain default tone for non-status tags.
 */
import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";

const badge = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-300",
  {
    variants: {
      tone: {
        default: "bg-neutral-bg text-neutral",
        good: "bg-good-bg text-good",
        warning: "bg-warning-bg text-warning",
        serious: "bg-serious-bg text-serious",
        critical: "bg-critical-bg text-critical",
        neutral: "bg-neutral-bg text-neutral",
        accent: "bg-accent/10 text-accent",
      },
    },
    defaultVariants: { tone: "default" },
  }
);

export interface BadgeProps extends VariantProps<typeof badge> {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, tone, className }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>;
}
