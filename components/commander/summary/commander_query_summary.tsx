"use client";

import { CalendarClock, Search, UserRound, Users } from "lucide-react";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { DrilldownFilter } from "@/components/commander/query/types";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
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
  const { t } = useT();
  const commonRank = Object.entries(
    officers.reduce<Record<string, number>>((acc, officer) => {
      acc[officer.rank] = (acc[officer.rank] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];
  const cycleBuckets: Array<{ labelKey: TranslationKey; bucket: string }> = [
    { labelKey: "commander.eligibleThisCycleShort", bucket: "eligible_this_cycle" },
    { labelKey: "commander.eligibleYear1", bucket: "eligible_year_1" },
    { labelKey: "commander.eligibleYear2", bucket: "eligible_year_2" },
    { labelKey: "commander.eligibleYear3", bucket: "eligible_year_3" },
    { labelKey: "commander.eligibleYear4", bucket: "eligible_year_4" },
    { labelKey: "commander.eligible5PlusYears", bucket: "eligible_more_than_5" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryTile label={t("commander.foundOfficers")} value={officers.length.toLocaleString()} icon={<Search className="h-4 w-4" />} />
        <SummaryTile
          label={t("commander.avgCompletedCycles")}
          value={fmt(average(officers.map((o) => o.completedPromotionCycles)))}
          hint={t("commander.avgCompletedCyclesHint")}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <SummaryTile label={t("commander.oldest")} value={oldest ? fmt(oldest.ageYears) : "—"} hint={oldest?.displayName} icon={<UserRound className="h-4 w-4" />} />
        <SummaryTile label={t("commander.youngest")} value={youngest ? fmt(youngest.ageYears) : "—"} hint={youngest?.displayName} icon={<UserRound className="h-4 w-4" />} />
        <SummaryTile
          label={t("commander.avgAppointmentCycle")}
          value={fmt(average(officers.map((o) => o.appointmentCycle)))}
          hint={t("commander.currentPositionLevelHint")}
          icon={<Users className="h-4 w-4" />}
        />
        <SummaryTile
          label={t("commander.avgAge")}
          value={fmt(average(officers.map((o) => o.ageYears)))}
          hint={commonRank ? `${t("commander.topRank")}: ${commonRank[0]}` : undefined}
          icon={<Users className="h-4 w-4" />}
          onClick={commonRank ? () => onDrilldown({ field: "rank", value: commonRank[0], label: `${t("commander.rank")}: ${commonRank[0]}` }) : undefined}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cycleBuckets.map(({ labelKey, bucket }) => (
          <SummaryTile
            key={bucket}
            label={t(labelKey)}
            value={officers.filter((officer) => officer.promotionCycleBucket === (bucket === "eligible_year_1" ? "eligible_this_cycle" : bucket)).length.toLocaleString()}
            icon={<CalendarClock className="h-4 w-4" />}
          />
        ))}
      </div>
    </div>
  );
}
