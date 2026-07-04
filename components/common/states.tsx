/**
 * Shared state components (Phase 14 UI): LoadingState (skeletons), ErrorState
 * (friendly message + retry), EmptyState. Used by every data view so loading/
 * error/empty presentation is consistent and never duplicated per page.
 */
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

/** A single shimmering skeleton block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-bg", className)} aria-hidden="true" />;
}

/** Skeleton table rows for list/detail loading. */
export function LoadingState({ rows = 6, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

/** Friendly error with a retry action. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-critical-bg bg-critical-bg/40 px-6 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-critical" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {message ? <p className="mt-1 max-w-md text-sm text-muted">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/** Empty result placeholder. */
export function EmptyState({ title = "Nothing here", message, icon }: { title?: string; message?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="text-muted" aria-hidden="true">
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {message ? <p className="max-w-md text-sm text-muted">{message}</p> : null}
    </div>
  );
}
