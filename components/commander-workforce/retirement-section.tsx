"use client";

import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";
import { MetricCard } from "@/components/commander-workforce/metric-card";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import { retirementLabelTh } from "@/components/commander-workforce/labels";

export function RetirementSection({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const { retirement } = viewModel;
  const displayBuckets = retirement.buckets.filter((b) => b.key !== "already_retired");

  return (
    <SectionShell
      title="ข่าวกรองการเกษียณ"
      description="ช่วงเวลาตามปีงบประมาณไทยจากข้อมูลที่มีอยู่"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {displayBuckets.map((bucket) => (
          <MetricCard
            key={bucket.key}
            labelTh={retirementLabelTh(bucket.key)}
            count={bucket.count}
            availability={{ status: "available" }}
            drilldown={bucket.drilldown}
            tone={
              bucket.key === "this_fiscal_year" || bucket.key === "within_1_year"
                ? "warning"
                : "neutral"
            }
          />
        ))}
      </div>
      <div className="mt-4">
        <MetricCard
          labelTh={retirement.commandPositionExposure.labelTh}
          count={retirement.commandPositionExposure.count}
          percentage={retirement.commandPositionExposure.percentage}
          availability={retirement.commandPositionExposure.availability}
          drilldown={retirement.commandPositionExposure.drilldown}
          descriptionTh={retirement.commandPositionExposure.descriptionTh}
          tone="serious"
        />
      </div>
    </SectionShell>
  );
}
