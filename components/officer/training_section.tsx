/**
 * TrainingSection (Phase 21A — Editable Profile Foundation, Part 9;
 * Phase 23A — real Training data; Phase 26B Part 6 Part J — reusable
 * structure confirmation).
 *
 * Read-only Training card: lists each Training row (year, course,
 * organization, notes) or the empty state when the officer has none. The
 * editable counterpart is TrainingEditor, shown instead when the workspace
 * is in edit mode.
 *
 * Phase 26B Part 6 Part J's reusable structure (Course/Organization/Year/
 * Certificate) is already satisfied by the persisted Training row for the
 * first 3 fields (course/organization/year); Certificate is not yet a
 * column (no schema change in this UX-only phase — see AGENTS.md's
 * additive-only migration convention) and is documented here as the one
 * future field, the same "prepare, don't invent the column yet" pattern
 * used by AchievementsSection's FutureAchievement/ACHIEVEMENT_CATEGORY_OPTIONS.
 */
"use client";

import { BookOpen } from "lucide-react";
import type { Training } from "@/lib/database/query_types";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";
import { useT } from "@/components/i18n/language_provider";

export function TrainingSection({ training }: { training: Training[] }) {
  const { t } = useT();
  return (
    <EditableSectionCard title={t("officer.training")}>
      {training.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <BookOpen className="h-8 w-8 text-muted" aria-hidden="true" />
          <SectionEmptyState message={t("officer.noTraining")} />
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
