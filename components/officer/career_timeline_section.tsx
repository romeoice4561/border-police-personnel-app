/**
 * CareerTimelineSection (Phase 21A — Editable Profile Foundation, Part 6;
 * Phase 23A — real rank/source/verified data).
 *
 * Read-only timeline view: Date, Rank, Position, Unit, Source, Verified.
 * Since Phase 23A, all six columns are backed by real Timeline columns
 * (rank/source/verified were added additively) — a row imported before this
 * phase simply has rank/source = null and verified = "ยังไม่ตรวจ" (the
 * column's default), rendered as "—"/the default badge rather than invented.
 * The editable counterpart is CareerTimelineEditor, shown instead when the
 * workspace is in edit mode.
 */
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import type { Timeline } from "@/lib/database/query_types";
import { sortTimelineByYear } from "@/lib/ui/officer_summary";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

/** The display row shape — now backed entirely by real Timeline columns (Phase 23A). */
export interface CareerTimelineRow {
  id: number;
  date: string;
  rank: string | null;
  position: string;
  unit: string | null;
  source: string | null;
  verified: string;
}

/** Maps a persisted Timeline row onto the display shape. */
function toCareerTimelineRow(entry: Timeline): CareerTimelineRow {
  return {
    id: entry.id,
    date: entry.year,
    rank: entry.rank,
    position: entry.position,
    unit: entry.unit,
    source: entry.source,
    verified: entry.verified,
  };
}

const VERIFIED_STATUS = "ยืนยันแล้ว";

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
                      {row.verified === VERIFIED_STATUS ? (
                        <span className="inline-flex items-center gap-1 text-good">
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          {row.verified}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
                          {row.verified}
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
