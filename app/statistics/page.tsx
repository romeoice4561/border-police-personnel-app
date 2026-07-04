/**
 * Statistics (Phase 14): the KPI stat-tile row plus unit and rank breakdown
 * lists (each with officer counts). Breakdowns are ranked bar-style rows —
 * magnitude by length, count as a direct label — not a plotted chart, since
 * the data is a short ranked list read as a table.
 */
"use client";

import { useRanks, useStatistics, useUnits } from "@/lib/ui/hooks";
import { PageHeader } from "@/components/common/page_header";
import { StatisticsCards } from "@/components/common/statistics_cards";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";

/** A ranked count list where each row's fill length encodes its share of the max. */
function CountList({ items }: { items: Array<{ label: string; count: number }> }) {
  if (items.length === 0) return <EmptyState title="No data" />;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2">
      {items.slice(0, 12).map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-foreground" title={item.label}>
            {item.label}
          </span>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-bg" aria-hidden="true">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-accent"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function StatisticsPage() {
  const stats = useStatistics();
  const units = useUnits();
  const ranks = useRanks();

  return (
    <div className="space-y-8">
      <PageHeader title="Statistics" description="Aggregate metrics across the personnel knowledge base." />

      <section aria-label="Key statistics">
        {stats.isPending ? (
          <LoadingState rows={2} label="Loading statistics…" />
        ) : stats.isError ? (
          <ErrorState message={(stats.error as Error).message} onRetry={() => stats.refetch()} />
        ) : (
          <StatisticsCards stats={stats.data} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Officers by Unit</CardTitle>
          </CardHeader>
          <CardBody>
            {units.isPending ? (
              <LoadingState rows={5} />
            ) : units.isError ? (
              <ErrorState message={(units.error as Error).message} onRetry={() => units.refetch()} />
            ) : (
              <CountList items={(units.data ?? []).map((u) => ({ label: u.unit, count: u.officerCount }))} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Officers by Rank</CardTitle>
          </CardHeader>
          <CardBody>
            {ranks.isPending ? (
              <LoadingState rows={5} />
            ) : ranks.isError ? (
              <ErrorState message={(ranks.error as Error).message} onRetry={() => ranks.refetch()} />
            ) : (
              <CountList items={(ranks.data ?? []).map((r) => ({ label: r.rank, count: r.officerCount }))} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
