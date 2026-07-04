/**
 * OfficerTimeline (Phase 15A).
 *
 * The officer's career timeline sorted by year (newest → oldest via the pure
 * sortTimelineByYear helper). Presentational Server Component. A missing
 * unit/year renders an explicit "—"; an empty timeline shows a placeholder.
 */
import type { Timeline } from "@/lib/database/query_types";
import { sortTimelineByYear } from "@/lib/ui/officer_summary";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export function OfficerTimeline({ timeline }: { timeline: Timeline[] }) {
  const sorted = sortTimelineByYear(timeline);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Career Timeline</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {sorted.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No career-history entries on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-3 font-medium">Year</th>
                  <th scope="col" className="px-5 py-3 font-medium">Position</th>
                  <th scope="col" className="px-5 py-3 font-medium">Unit</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums">{entry.year || "—"}</td>
                    <td className="px-5 py-3">{entry.position || "—"}</td>
                    <td className="px-5 py-3 text-muted">{entry.unit || "—"}</td>
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
