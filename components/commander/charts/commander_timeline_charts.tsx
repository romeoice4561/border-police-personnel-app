"use client";

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { DrilldownFilter } from "@/components/commander/query/types";
import { useT } from "@/components/i18n/language_provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

function cycleBucket(value: number | null): string {
  if (value == null) return "Unknown";
  if (value >= 5) return "5+ cycles";
  return `${value} cycle${value === 1 ? "" : "s"}`;
}

function countBy<T extends string | number | null>(officers: CommanderQueryOfficer[], getValue: (officer: CommanderQueryOfficer) => T) {
  const counts = new Map<string, { raw: T; value: number }>();
  for (const officer of officers) {
    const raw = getValue(officer);
    const label = raw == null || raw === "" ? "Unknown" : String(raw);
    counts.set(label, { raw, value: (counts.get(label)?.value ?? 0) + 1 });
  }
  return [...counts.entries()].map(([label, row]) => ({ label, raw: row.raw, value: row.value })).sort((a, b) => a.label.localeCompare(b.label));
}

function Timeline({
  title,
  rows,
  onClick,
}: {
  title: string;
  rows: Array<{ label: string; raw: string | number | null; value: number }>;
  onClick?: (row: { label: string; raw: string | number | null; value: number }) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {rows.length === 0 ? <p className="text-sm text-muted">No timeline data available.</p> : null}
        {rows.slice(0, 10).map((row) => {
          const content = (
            <>
              <span className="text-sm text-muted">{row.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-neutral-bg">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(row.value / max) * 100}%` }} />
              </span>
              <span className="text-right text-sm tabular-nums text-foreground">{row.value}</span>
            </>
          );
          return onClick ? (
            <button key={row.label} type="button" className="grid w-full grid-cols-[100px_1fr_40px] items-center gap-2 text-left" onClick={() => onClick(row)}>
              {content}
            </button>
          ) : (
            <div key={row.label} className="grid grid-cols-[100px_1fr_40px] items-center gap-2">
              {content}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

export function CommanderTimelineCharts({
  officers,
  onDrilldown,
}: {
  officers: CommanderQueryOfficer[];
  onDrilldown: (next: DrilldownFilter) => void;
}) {
  const { t } = useT();
  const promotionRows = countBy(officers, (officer) => cycleBucket(officer.completedPromotionCycles));
  const retirementRows = countBy(officers, (officer) => officer.retirementYear);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Timeline title={t("commander.promotionCycleDistribution")} rows={promotionRows} />
      <Timeline
        title={t("commander.retirementTimeline")}
        rows={retirementRows}
        onClick={(row) => onDrilldown({ field: "retirementYear", value: row.raw, label: `${t("commander.retirementYear")}: ${row.label}` })}
      />
    </div>
  );
}
