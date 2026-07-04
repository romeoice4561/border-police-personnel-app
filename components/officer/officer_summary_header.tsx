/**
 * OfficerSummaryHeader (Phase 15A; Phase 17B photo).
 *
 * The detail-page hero: the officer's large Drive photo (with placeholder
 * fallback), rank, full name, current position, region, and a quality badge.
 * Presentational Server Component — receives the officer row and renders; no
 * data fetching, no state. The photo comes from the stored `thumbnailUrl`.
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { officerFullName } from "@/lib/ui/officer_summary";
import { QualityBadge } from "@/components/common/quality_badge";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { Badge } from "@/components/ui/badge";

export function OfficerSummaryHeader({ officer }: { officer: OfficerWithRelations }) {
  const name = officerFullName(officer);
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Large officer photo — real Drive thumbnail when stored, else placeholder. */}
      <OfficerPhoto thumbnailUrl={officer.thumbnailUrl} name={name} size={80} />

      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{officer.rank || "—"}</p>
        <h1 className="truncate text-2xl font-semibold text-foreground">{name}</h1>
        <p className="mt-0.5 truncate text-sm text-muted">{officer.currentPosition || "—"}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <QualityBadge score={officer.qualityScore} />
        {officer.region ? <Badge>{officer.region}</Badge> : null}
      </div>
    </header>
  );
}
