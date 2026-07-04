/**
 * Dashboard (Phase 14): overview — statistics KPI row, backend health, and a
 * preview of recent officers. Client component (uses the data hooks).
 */
"use client";

import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { useHealth, useOfficers, useStatistics } from "@/lib/ui/hooks";
import { PageHeader } from "@/components/common/page_header";
import { StatisticsCards } from "@/components/common/statistics_cards";
import { OfficerTable } from "@/components/common/officer_table";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function HealthPill() {
  const { data, isError } = useHealth();
  const healthy = !isError && data?.status === "ok";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {healthy ? (
        <CheckCircle2 className="h-4 w-4 text-good" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 text-critical" aria-hidden="true" />
      )}
      <span className={healthy ? "text-good" : "text-critical"}>
        {healthy ? `API healthy · v${data?.version}` : "API unavailable"}
      </span>
    </span>
  );
}

export default function DashboardPage() {
  const stats = useStatistics();
  const recent = useOfficers({ page: 1, pageSize: 5, sortBy: "createdAt", sortOrder: "desc" });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of the Border Patrol personnel knowledge base."
        actions={<HealthPill />}
      />

      <section aria-label="Key statistics">
        {stats.isPending ? (
          <LoadingState rows={2} label="Loading statistics…" />
        ) : stats.isError ? (
          <ErrorState message={(stats.error as Error).message} onRetry={() => stats.refetch()} />
        ) : (
          <StatisticsCards stats={stats.data} />
        )}
      </section>

      <section className="space-y-3" aria-label="Recent officers">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent Officers</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/officers">View all</Link>
          </Button>
        </div>

        {recent.isPending ? (
          <LoadingState />
        ) : recent.isError ? (
          <ErrorState message={(recent.error as Error).message} onRetry={() => recent.refetch()} />
        ) : recent.data.data.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No officers yet</CardTitle>
            </CardHeader>
            <CardBody>
              <EmptyState
                title="The database is empty"
                message="Run the database import (scripts/run_database_import.ts) to populate officers."
              />
            </CardBody>
          </Card>
        ) : (
          <OfficerTable officers={recent.data.data} />
        )}
      </section>
    </div>
  );
}
