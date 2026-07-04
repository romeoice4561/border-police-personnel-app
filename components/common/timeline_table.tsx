/**
 * TimelineTable (Phase 14 UI): an officer's career timeline (year, position,
 * unit) in sequence order. A missing unit is shown as an explicit muted "—"
 * (it's legitimately often absent — never fabricated by the pipeline).
 */
import type { TimelineEntry } from "@/lib/ui/api_client";
import { EmptyState } from "@/components/common/states";

export function TimelineTable({ timeline }: { timeline: TimelineEntry[] }) {
  if (timeline.length === 0) {
    return <EmptyState title="No timeline" message="This record has no career-history entries." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-4 py-3 font-medium">Year</th>
            <th scope="col" className="px-4 py-3 font-medium">Position</th>
            <th scope="col" className="px-4 py-3 font-medium">Unit</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map((entry) => (
            <tr key={entry.sequence} className="border-b border-border last:border-0">
              <td className="px-4 py-3 tabular-nums whitespace-nowrap">{entry.year || "—"}</td>
              <td className="px-4 py-3">{entry.position || "—"}</td>
              <td className="px-4 py-3 text-muted">{entry.unit || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
