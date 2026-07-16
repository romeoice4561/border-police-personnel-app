/**
 * WorkspaceActions (Phase 48A — Enterprise Workspace Foundation).
 *
 * The optional action-button row for WorkspaceHeader. A thin layout wrapper —
 * callers still use the existing Button component for each action — so every
 * page's header actions get identical spacing/alignment without a new button
 * primitive.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function WorkspaceActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
