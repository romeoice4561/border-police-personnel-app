/**
 * CareerTimelineSection (Phase 21A — Editable Profile Foundation, Part 6).
 *
 * Enhances the timeline row ARCHITECTURE (not the schema): Date, Rank,
 * Position, Unit, Source, Verified. Only Date/Position/Unit have persisted
 * data today (Timeline.year/position/unit) — Rank-per-entry, Source, and
 * Verified have no backing field yet, so they render "—" / an unverified
 * badge rather than being invented. No migration, no redesign of the existing
 * OfficerTimeline (left untouched); this is a new, additive, richer view used
 * on the profile page going forward.
 */
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import type { Timeline } from "@/lib/database/query_types";
import { sortTimelineByYear } from "@/lib/ui/officer_summary";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The full row shape the timeline architecture supports going forward. Fields
 * with no persisted source yet are typed as always-absent here (`rank`,
 * `source`) or a fixed default (`verified: false`) — documented, not
 * fabricated.
 */
export interface CareerTimelineRow {
  id: number;
  date: string;
  rank: string | null;
  position: string;
  unit: string | null;
  source: string | null;
  verified: boolean;
}

/** Maps a persisted Timeline row onto the enhanced architecture. Unbacked fields are explicitly null/false. */
function toCareerTimelineRow(entry: Timeline): CareerTimelineRow {
  return {
    id: entry.id,
    date: entry.year,
    rank: null,
    position: entry.position,
    unit: entry.unit,
    source: null,
    verified: false,
  };
}

export function CareerTimelineSection({ timeline }: { timeline: Timeline[] }) {
  const rows = sortTimelineByYear(timeline).map(toCareerTimelineRow);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Career Timeline</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No career-history entries on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-3 font-medium">Date</th>
                  <th scope="col" className="px-5 py-3 font-medium">Rank</th>
                  <th scope="col" className="px-5 py-3 font-medium">Position</th>
                  <th scope="col" className="px-5 py-3 font-medium">Unit</th>
                  <th scope="col" className="px-5 py-3 font-medium">Source</th>
                  <th scope="col" className="px-5 py-3 font-medium">Verified</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums">{row.date || "—"}</td>
                    <td className="px-5 py-3 text-muted">{row.rank || "—"}</td>
                    <td className="px-5 py-3">{row.position || "—"}</td>
                    <td className="px-5 py-3 text-muted">{row.unit || "—"}</td>
                    <td className="px-5 py-3 text-muted">{row.source || "—"}</td>
                    <td className="px-5 py-3">
                      {row.verified ? (
                        <span className="inline-flex items-center gap-1 text-good">
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
                          Unverified
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
