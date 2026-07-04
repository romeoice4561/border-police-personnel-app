/**
 * OfficerSummaryHeader (Phase 15A).
 *
 * The detail-page hero: photo placeholder, rank, full name, current position,
 * region, and a quality badge. Presentational Server Component — receives the
 * officer row and renders; no data fetching, no state.
 */
import { User } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { officerFullName } from "@/lib/ui/officer_summary";
import { QualityBadge } from "@/components/common/quality_badge";
import { Badge } from "@/components/ui/badge";

export function OfficerSummaryHeader({ officer }: { officer: OfficerWithRelations }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Photo placeholder — no portrait is stored; a neutral avatar stands in. */}
      <div
        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-border bg-neutral-bg text-muted"
        aria-label="No photo available"
      >
        <User className="h-9 w-9" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{officer.rank || "—"}</p>
        <h1 className="truncate text-2xl font-semibold text-foreground">{officerFullName(officer)}</h1>
        <p className="mt-0.5 truncate text-sm text-muted">{officer.currentPosition || "—"}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <QualityBadge score={officer.qualityScore} />
        {officer.region ? <Badge>{officer.region}</Badge> : null}
      </div>
    </header>
  );
}
