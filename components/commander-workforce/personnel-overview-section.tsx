"use client";

import type { CommanderWorkforceViewModel, WorkforceMetric } from "@/lib/commander_workforce/types";
import { MetricCard } from "@/components/commander-workforce/metric-card";
import { DrilldownLink } from "@/components/commander-workforce/drilldown-link";
import { SectionShell } from "@/components/commander-workforce/section-shell";
import {
  formatCompanyLabelTh,
  formatDivisionLabelTh,
  formatRegionLabelTh,
  formatPositionLevelLabelTh,
  sanitizeExecutiveCopy,
} from "@/components/commander-workforce/labels";

function presentOverviewLabel(metric: WorkforceMetric): string {
  if (metric.key.startsWith("company:")) return formatCompanyLabelTh(metric.labelTh);
  if (metric.key.startsWith("division:")) return formatDivisionLabelTh(metric.labelTh);
  if (metric.key.startsWith("region:")) return formatRegionLabelTh(metric.labelTh);
  if (metric.key.startsWith("positionLevel:")) return formatPositionLevelLabelTh(metric.labelTh);
  if (metric.key.startsWith("rank:")) return metric.labelTh;
  return sanitizeExecutiveCopy(metric.labelTh) || metric.labelTh;
}

function DistributionList({ title, items }: { title: string; items: WorkforceMetric[] }) {
  const max = Math.max(1, ...items.map((i) => (i.availability.status === "available" ? i.count : 0)));
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">ยังไม่มีข้อมูลในขอบเขตนี้</p>
      ) : (
        <ul className="mt-4 space-y-3" aria-label={title}>
          {items.map((item) => {
            const label = presentOverviewLabel(item);
            if (item.availability.status === "unavailable") {
              return (
                <li key={item.key} className="text-xs text-muted">
                  {label}: ยังประเมินไม่ได้
                </li>
              );
            }
            const width = Math.round((item.count / max) * 100);
            return (
              <li key={item.key}>
                <DrilldownLink drilldown={item.drilldown} className="block">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-foreground" title={label}>
                      {label}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {item.count.toLocaleString("th-TH")}
                      {item.percentage != null ? ` (${item.percentage}%)` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/60">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} aria-hidden />
                  </div>
                </DrilldownLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function PersonnelOverviewSection({ viewModel }: { viewModel: CommanderWorkforceViewModel }) {
  const { overview } = viewModel;

  return (
    <SectionShell title="ภาพรวมกำลังพล" description="การกระจายจากข้อมูลในขอบเขตตัวกรองปัจจุบัน">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overview.metrics.map((metric) => (
          <MetricCard
            key={metric.key}
            labelTh={sanitizeExecutiveCopy(metric.labelTh) || metric.labelTh}
            count={metric.count}
            percentage={metric.percentage}
            availability={metric.availability}
            drilldown={metric.drilldown}
            descriptionTh={metric.descriptionTh}
            tone={metric.key === "total_personnel" ? "overview" : "neutral"}
          />
        ))}
        <MetricCard
          labelTh={overview.vacancy.labelTh}
          count={overview.vacancy.count}
          percentage={overview.vacancy.percentage}
          availability={overview.vacancy.availability}
          drilldown={overview.vacancy.drilldown}
          descriptionTh={overview.vacancy.descriptionTh}
        />
        <MetricCard
          labelTh={overview.personnelCategory.labelTh}
          count={overview.personnelCategory.count}
          percentage={overview.personnelCategory.percentage}
          availability={overview.personnelCategory.availability}
          drilldown={overview.personnelCategory.drilldown}
          descriptionTh={overview.personnelCategory.descriptionTh}
        />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <DistributionList title="แยกตามยศ" items={overview.byRank} />
        <DistributionList title="แยกตามระดับตำแหน่ง" items={overview.byPositionLevel} />
        <DistributionList title="แยกตามภาค" items={overview.byRegion} />
        <DistributionList title="แยกตามกองกำกับการ" items={overview.byDivision} />
        <DistributionList title="แยกตามกองร้อย" items={overview.byCompany} />
      </div>
    </SectionShell>
  );
}
