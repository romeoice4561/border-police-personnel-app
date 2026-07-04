/**
 * StatisticsCards (Phase 14 UI).
 *
 * A KPI row of stat tiles — the correct form for headline magnitudes (totals,
 * averages, counts), not a chart. Each tile is a hero number + label + icon.
 * The average-quality tile carries a status tone from the shared banding; the
 * duplicate tiles turn warning/critical only when non-zero (reserved status
 * colors, always with a label). No plotted axes here by design.
 */
import type { ReactNode } from "react";
import {
  Users,
  CalendarClock,
  ShieldCheck,
  Building2,
  Map as MapIcon,
  ListOrdered,
  PhoneOff,
  UserX,
} from "lucide-react";
import type { Statistics } from "@/lib/ui/api_client";
import { Card, CardBody } from "@/components/ui/card";
import { bandForScore, type StatusTone } from "@/lib/ui/quality";
import { cn } from "@/lib/ui/cn";

const TONE_TEXT: Record<StatusTone, string> = {
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  critical: "text-critical",
  neutral: "text-foreground",
};

function StatTile({
  label,
  value,
  icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: StatusTone;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <span className="text-muted" aria-hidden="true">
            {icon}
          </span>
        </div>
        <p className={cn("text-2xl font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

export function StatisticsCards({ stats }: { stats: Statistics }) {
  const qualityTone = bandForScore(stats.averageQuality).tone;
  const iconClass = "h-4 w-4";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Total Officers" value={stats.totalOfficers.toLocaleString()} icon={<Users className={iconClass} />} />
      <StatTile
        label="Avg Career"
        value={`${stats.averageCareerYears} yrs`}
        icon={<CalendarClock className={iconClass} />}
      />
      <StatTile
        label="Avg Quality"
        value={stats.averageQuality}
        tone={qualityTone}
        icon={<ShieldCheck className={iconClass} />}
        hint={bandForScore(stats.averageQuality).band}
      />
      <StatTile label="Units" value={stats.units.toLocaleString()} icon={<Building2 className={iconClass} />} />
      <StatTile label="Regions" value={stats.regions.toLocaleString()} icon={<MapIcon className={iconClass} />} />
      <StatTile
        label="Timeline Entries"
        value={stats.timelines.toLocaleString()}
        icon={<ListOrdered className={iconClass} />}
      />
      <StatTile
        label="Duplicate Phones"
        value={stats.duplicatePhones.toLocaleString()}
        tone={stats.duplicatePhones > 0 ? "warning" : "neutral"}
        icon={<PhoneOff className={iconClass} />}
      />
      <StatTile
        label="Duplicate Names"
        value={stats.duplicateNames.toLocaleString()}
        tone={stats.duplicateNames > 0 ? "warning" : "neutral"}
        icon={<UserX className={iconClass} />}
      />
    </div>
  );
}
