/**
 * TrainingSection (Phase 21A — Editable Profile Foundation, Part 9;
 * Phase 23A — real Training data).
 *
 * Read-only Training card: lists each Training row (year, course,
 * organization, notes) or the empty state when the officer has none. The
 * editable counterpart is TrainingEditor, shown instead when the workspace
 * is in edit mode.
 */
import { BookOpen } from "lucide-react";
import type { Training } from "@/lib/database/query_types";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";

export function TrainingSection({ training }: { training: Training[] }) {
  return (
    <EditableSectionCard title="Training">
      {training.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <BookOpen className="h-8 w-8 text-muted" aria-hidden="true" />
          <SectionEmptyState message="No training courses yet." />
        </div>
      ) : (
        <ul className="space-y-3">
          {training.map((row) => (
            <li key={row.id} className="rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{row.course}</span>
                {row.year ? <span className="shrink-0 text-xs tabular-nums text-muted">{row.year}</span> : null}
              </div>
              {row.organization ? <p className="mt-0.5 text-sm text-muted">{row.organization}</p> : null}
              {row.notes ? <p className="mt-1 text-xs text-muted">{row.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </EditableSectionCard>
  );
}
