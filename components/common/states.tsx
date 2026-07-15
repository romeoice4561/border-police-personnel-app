/**
 * Shared state components (Phase 14 UI): LoadingState (skeletons), ErrorState
 * (friendly message + retry), EmptyState. Used by every data view so loading/
 * error/empty presentation is consistent and never duplicated per page.
 */
"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";

/** A single shimmering skeleton block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-bg", className)} aria-hidden="true" />;
}

/** Skeleton table rows for list/detail loading. Defaults its label to the active-language "Loading…". */
export function LoadingState({ rows = 6, label }: { rows?: number; label?: string }) {
  const { t } = useT();
  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label ?? t("common.loading")}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

/** Friendly error with a retry action. Title/retry default to the active language. */
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-critical-bg bg-critical-bg/40 px-6 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-critical" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">{title ?? t("common.error")}</p>
        {message ? <p className="mt-1 max-w-md text-sm text-muted">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}

/** Empty result placeholder. Title defaults to the active-language "No data". */
export function EmptyState({ title, message, icon }: { title?: string; message?: string; icon?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="text-muted" aria-hidden="true">
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <p className="font-medium text-foreground">{title ?? t("common.noData")}</p>
      {message ? <p className="max-w-md text-sm text-muted">{message}</p> : null}
    </div>
  );
}
