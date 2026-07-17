"use client";

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { DrilldownFilter } from "@/components/commander/query/types";
import { useT } from "@/components/i18n/language_provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Task A5: whole-cycle Thai labels ("ครบ 5 รอบขึ้นไป", "N รอบ") reusing the
 * SAME `completedPromotionCycles` field the results table/summary already
 * read — bucketing for chart-axis grouping only, not a new eligibility
 * concept (distinct from officer.promotionCycleBucket, which drives
 * filters/summary tiles elsewhere).
 */
function cycleBucketLabelTh(value: number | null, unknownLabel: string): string {
  if (value == null) return unknownLabel;
  if (value >= 5) return "ครบ 5 รอบขึ้นไป";
  return `${value} รอบ`;
}

function countBy<T extends string | number | null>(
  officers: CommanderQueryOfficer[],
  getValue: (officer: CommanderQueryOfficer) => T,
  unknownLabel: string,
  getLabel: (officer: CommanderQueryOfficer) => string | number | null = getValue
) {
  const counts = new Map<string, { raw: T; label: string; value: number }>();
  for (const officer of officers) {
    const raw = getValue(officer);
    const key = raw == null || raw === "" ? unknownLabel : String(raw);
    const displayLabel = raw == null || raw === "" ? unknownLabel : String(getLabel(officer));
    const existing = counts.get(key);
    counts.set(key, { raw, label: displayLabel, value: (existing?.value ?? 0) + 1 });
  }
  return [...counts.entries()].map(([, row]) => row).sort((a, b) => a.label.localeCompare(b.label, "th"));
}

function Timeline({
  title,
  rows,
  emptyLabel,
  onClick,
}: {
  title: string;
  rows: Array<{ label: string; raw: string | number | null; value: number }>;
  emptyLabel: string;
  onClick?: (row: { label: string; raw: string | number | null; value: number }) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {rows.length === 0 ? <p className="text-sm text-muted">{emptyLabel}</p> : null}
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
  const unknownLabel = t("commander.summaryUnknown");
  const promotionRows = countBy(officers, (officer) => cycleBucketLabelTh(officer.completedPromotionCycles, unknownLabel), unknownLabel);
  const retirementRows = countBy(
    officers,
    (officer) => officer.retirementYear,
    unknownLabel,
    (officer) => officer.retirementYearBe
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Timeline title={t("commander.promotionCycleDistribution")} rows={promotionRows} emptyLabel={t("commander.noTimelineData")} />
      <Timeline
        title={t("commander.retirementTimeline")}
        rows={retirementRows}
        emptyLabel={t("commander.noTimelineData")}
        onClick={(row) => onDrilldown({ field: "retirementYear", value: row.raw, label: `${t("commander.retirementYear")}: ${row.label}` })}
      />
    </div>
  );
}
