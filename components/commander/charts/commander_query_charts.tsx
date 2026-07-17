"use client";

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { DrilldownFilter } from "@/components/commander/query/types";
import { PROMOTION_STATUS_DISPLAY_TH } from "@/lib/intelligence/promotion";
import { useT } from "@/components/i18n/language_provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

interface Slice {
  label: string;
  value: number;
  color: string;
}

function distribution<T extends string | number | null>(
  officers: CommanderQueryOfficer[],
  getValue: (officer: CommanderQueryOfficer) => T,
  fallbackLabel: string
): Array<{ label: string; raw: T; value: number }> {
  const counts = new Map<string, { raw: T; value: number }>();
  for (const officer of officers) {
    const raw = getValue(officer);
    const label = raw == null || raw === "" ? fallbackLabel : String(raw);
    counts.set(label, { raw, value: (counts.get(label)?.value ?? 0) + 1 });
  }
  return [...counts.entries()].map(([label, row]) => ({ label, raw: row.raw, value: row.value })).sort((a, b) => b.value - a.value);
}

function PieChart({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let cursor = 0;
  const gradient = slices
    .map((slice) => {
      const start = cursor;
      const end = cursor + (total > 0 ? (slice.value / total) * 100 : 0);
      cursor = end;
      return `${slice.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="h-32 w-32 shrink-0 rounded-full border border-border" style={{ background: total > 0 ? `conic-gradient(${gradient})` : undefined }} />
      <div className="space-y-2">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden="true" />
            <span className="text-foreground">{slice.label}</span>
            <span className="tabular-nums text-muted">{slice.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({
  title,
  rows,
  onClick,
}: {
  title: string;
  rows: Array<{ label: string; raw: string | number | null; value: number }>;
  onClick: (row: { label: string; raw: string | number | null; value: number }) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        {rows.slice(0, 8).map((row) => (
          <button key={row.label} type="button" className="grid w-full grid-cols-[120px_1fr_40px] items-center gap-2 text-left text-sm" onClick={() => onClick(row)}>
            <span className="truncate text-muted">{row.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-neutral-bg">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(row.value / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums text-foreground">{row.value}</span>
          </button>
        ))}
      </CardBody>
    </Card>
  );
}

export function CommanderQueryCharts({
  officers,
  onDrilldown,
}: {
  officers: CommanderQueryOfficer[];
  onDrilldown: (next: DrilldownFilter) => void;
}) {
  const { t } = useT();
  const unknownLabel = t("commander.summaryUnknown");
  // Task A5: the result-distribution pie uses the SAME Promotion Intelligence
  // status (promotionIntelligence.promotionStatus) as the results table's
  // status badge and the Intelligence Summary cards — never the legacy
  // score-ratio promotionStatus field — so chart totals always match the
  // table/summary for the identical filtered set.
  const promotion = distribution(officers, (officer) => officer.promotionIntelligence.promotionStatus, unknownLabel).map((row, index) => ({
    label: row.raw ? PROMOTION_STATUS_DISPLAY_TH[row.raw] : unknownLabel,
    value: row.value,
    color: ["#16a34a", "#f59e0b", "#dc2626", "#64748b", "#0ea5e9", "#a855f7", "#ef4444", "#64748b"][index % 8],
  }));
  const rankRows = distribution(officers, (officer) => officer.rank, unknownLabel);
  const positionRows = distribution(officers, (officer) => officer.positionLevel, unknownLabel);
  const companyRows = distribution(officers, (officer) => officer.companyLabel, unknownLabel);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("commander.resultDistribution")}</CardTitle>
        </CardHeader>
        <CardBody>
          <PieChart slices={promotion} />
        </CardBody>
      </Card>
      <BarChart title={t("commander.rankDistribution")} rows={rankRows} onClick={(row) => onDrilldown({ field: "rank", value: row.raw, label: `${t("commander.rank")}: ${row.label}` })} />
      <BarChart title={t("commander.positionLevelDistribution")} rows={positionRows} onClick={(row) => onDrilldown({ field: "positionLevel", value: row.raw, label: `${t("commander.positionLevel")}: ${row.label}` })} />
      <BarChart title={t("commander.companyDistribution")} rows={companyRows} onClick={(row) => onDrilldown({ field: "companyLabel", value: row.raw, label: `${t("commander.company")}: ${row.label}` })} />
    </div>
  );
}
