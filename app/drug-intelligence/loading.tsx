/**
 * Drug Intelligence segment loading UI (DI-9.4.3A).
 *
 * Shown during App Router soft navigations into /drug-intelligence/** while
 * the destination segment resolves. Renders INSIDE AppShell (sidebar stays),
 * so users get immediate feedback without a full-page spinner takeover.
 *
 * Intentionally lightweight: skeleton surfaces only — no fake percentages,
 * no Map-filter behavior changes (DI-8.2.1 window.location.assign untouched).
 */
import { LoadingState, Skeleton } from "@/components/common/states";

export default function DrugIntelligenceLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="di-route-loading"
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <LoadingState rows={6} />
    </div>
  );
}
