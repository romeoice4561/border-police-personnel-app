import { CalendarClock, Search, UserRound, Users } from "lucide-react";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { DrilldownFilter } from "@/components/commander/query/types";
import { Card, CardBody } from "@/components/ui/card";

function average(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number");
  if (nums.length === 0) return null;
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(1));
}

function fmt(value: number | null): string {
  return value == null ? "—" : String(value);
}

function SummaryTile({
  label,
  value,
  hint,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <CardBody className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <span className="text-muted" aria-hidden="true">{icon}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </CardBody>
  );
  return onClick ? (
    <button type="button" className="text-left" onClick={onClick}>
      <Card className="h-full transition-colors hover:border-accent">{content}</Card>
    </button>
  ) : (
    <Card className="h-full">{content}</Card>
  );
}

export function CommanderQuerySummary({
  officers,
  onDrilldown,
}: {
  officers: CommanderQueryOfficer[];
  onDrilldown: (next: DrilldownFilter) => void;
}) {
  const oldest = [...officers].sort((a, b) => ((b.ageYears ?? -1) - (a.ageYears ?? -1)))[0];
  const youngest = [...officers].sort((a, b) => ((a.ageYears ?? Number.MAX_VALUE) - (b.ageYears ?? Number.MAX_VALUE)))[0];
  const commonRank = Object.entries(
    officers.reduce<Record<string, number>>((acc, officer) => {
      acc[officer.rank] = (acc[officer.rank] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];
  const cycleBuckets = [
    ["Eligible This Cycle", "eligible_this_cycle"],
    ["Eligible Year 1", "eligible_year_1"],
    ["Eligible Year 2", "eligible_year_2"],
    ["Eligible Year 3", "eligible_year_3"],
    ["Eligible Year 4", "eligible_year_4"],
    ["Eligible 5+ Years", "eligible_more_than_5"],
  ] as const;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryTile label="Found Officers" value={officers.length.toLocaleString()} icon={<Search className="h-4 w-4" />} />
        <SummaryTile label="Average Years" value={fmt(average(officers.map((o) => o.yearsInRank)))} hint="in current rank" icon={<CalendarClock className="h-4 w-4" />} />
        <SummaryTile label="Oldest" value={oldest ? fmt(oldest.ageYears) : "—"} hint={oldest?.displayName} icon={<UserRound className="h-4 w-4" />} />
        <SummaryTile label="Youngest" value={youngest ? fmt(youngest.ageYears) : "—"} hint={youngest?.displayName} icon={<UserRound className="h-4 w-4" />} />
        <SummaryTile label="Avg Service" value={fmt(average(officers.map((o) => o.governmentServiceYears)))} hint="government service" icon={<Users className="h-4 w-4" />} />
        <SummaryTile
          label="Avg Age"
          value={fmt(average(officers.map((o) => o.ageYears)))}
          hint={commonRank ? `Top rank: ${commonRank[0]}` : undefined}
          icon={<Users className="h-4 w-4" />}
          onClick={commonRank ? () => onDrilldown({ field: "rank", value: commonRank[0], label: `Rank: ${commonRank[0]}` }) : undefined}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cycleBuckets.map(([label, bucket]) => (
          <SummaryTile
            key={bucket}
            label={label}
            value={officers.filter((officer) => officer.promotionCycleBucket === (bucket === "eligible_year_1" ? "eligible_this_cycle" : bucket)).length.toLocaleString()}
            icon={<CalendarClock className="h-4 w-4" />}
          />
        ))}
      </div>
    </div>
  );
}
