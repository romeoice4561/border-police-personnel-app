"use client";

import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";
import { MetricCard } from "@/components/commander-workforce/metric-card";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import { documentMetricLabelTh, sanitizeExecutiveCopy } from "@/components/commander-workforce/labels";
import { StatusBadge } from "@/components/commander-workforce/status-badge";

export function DocumentSection({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const { documents } = viewModel;

  return (
    <SectionShell
      title="ข่าวกรองเอกสาร"
      description={`ประเมินแล้ว ${documents.totalEvaluated.toLocaleString("th-TH")} นาย`}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {documents.byStatus.map((metric) => {
          const labelTh = documentMetricLabelTh(metric.key, metric.labelTh);
          const isComplete = metric.key.endsWith(":complete");
          const isProblem =
            metric.key.includes("expired") ||
            metric.key.includes("missing") ||
            metric.key.includes("incomplete");
          return (
            <MetricCard
              key={metric.key}
              labelTh={labelTh}
              count={metric.count}
              percentage={metric.percentage}
              availability={metric.availability}
              drilldown={metric.drilldown}
              tone={isProblem ? "serious" : isComplete ? "good" : "neutral"}
              badge={
                isComplete && metric.count > 0 ? (
                  <StatusBadge kind="complete" />
                ) : isProblem && metric.count > 0 ? (
                  <StatusBadge kind="review" />
                ) : undefined
              }
            />
          );
        })}
        <MetricCard
          labelTh={sanitizeExecutiveCopy(documents.epfCompleteness.labelTh) || "ความครบถ้วนโปรไฟล์"}
          count={documents.epfCompleteness.count}
          percentage={documents.epfCompleteness.percentage}
          availability={documents.epfCompleteness.availability}
          drilldown={documents.epfCompleteness.drilldown}
          descriptionTh={documents.epfCompleteness.descriptionTh}
          tone="overview"
        />
      </div>
    </SectionShell>
  );
}
