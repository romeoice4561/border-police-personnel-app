"use client";

import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";
import { MetricCard } from "@/components/commander-workforce/metric-card";
import { AvailabilityState } from "@/components/commander-workforce/availability-state";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import { trainingMetricLabelTh } from "@/components/commander-workforce/labels";
import { StatusBadge } from "@/components/commander-workforce/status-badge";

export function TrainingSection({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const { training } = viewModel;

  return (
    <SectionShell
      title="ข่าวกรองหลักสูตร"
      description={`ประเมินแล้ว ${training.totalEvaluated.toLocaleString("th-TH")} นาย`}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {training.byStatus.map((metric) => {
          const labelTh = trainingMetricLabelTh(metric.key, metric.labelTh);
          const isComplete = metric.key.includes("Complete");
          const isProblem =
            metric.key.includes("Missing") || metric.key.includes("Expired");
          return (
            <MetricCard
              key={metric.key}
              labelTh={labelTh}
              count={metric.count}
              percentage={metric.percentage}
              availability={metric.availability}
              drilldown={metric.drilldown}
              tone={isProblem ? "warning" : isComplete ? "good" : "neutral"}
              badge={
                isComplete && metric.count > 0 ? (
                  <StatusBadge kind="complete" />
                ) : isProblem && metric.count > 0 ? (
                  <StatusBadge kind="attention" />
                ) : undefined
              }
            />
          );
        })}
      </div>
      {training.expiringSoonAvailability.status === "unavailable" ? (
        <div className="mt-3">
          <AvailabilityState availability={training.expiringSoonAvailability} />
        </div>
      ) : null}
    </SectionShell>
  );
}
