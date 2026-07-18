/**
 * TrainingSection (Phase 21A — Editable Profile Foundation, Part 9;
 * Phase 23A — real Training data; Phase 26B Part 6 Part J — reusable
 * structure confirmation; Phase 45 completion pass — Task 3: readable
 * chronological history, Buddhist-Era year display, per-row data-quality
 * indicators).
 *
 * Read-only Training card: lists each Training row (year, course,
 * organization, notes), sorted chronologically using the SAME
 * completionDate Training Intelligence already derives
 * (toTrainingRecordEvidenceBatch — a pure, presentation-only re-use of an
 * already-computed value, not a new calculation), or the empty state when
 * the officer has none. The editable counterpart is TrainingEditor, shown
 * instead when the workspace is in edit mode.
 *
 * Year display rule (Task 3): `Training.year` is free text (no real date
 * column). When it parses as an unambiguous 4-digit Buddhist-Era year
 * (Training Intelligence's completionDate is non-null), the Buddhist-Era
 * year is shown via the canonical formatter. Otherwise the raw stored
 * string is shown VERBATIM (e.g. "2563-2564", "ปัจจุบัน") — never
 * reformatted into a fabricated full date, and never silently dropped.
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
import { toTrainingRecordEvidenceBatch } from "@/lib/intelligence/training/evidence";
import { sortTrainingRowsChronologically, displayTrainingYear } from "@/lib/ui/training_history";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";
import { useT } from "@/components/i18n/language_provider";

export function TrainingSection({ training }: { training: Training[] }) {
  const { t } = useT();
  const evidence = toTrainingRecordEvidenceBatch(training);
  const evidenceById = new Map(evidence.map((e) => [e.recordId, e]));
  const sorted = sortTrainingRowsChronologically(training);

  return (
    <EditableSectionCard title={t("officer.trainingHistoryTitle")}>
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <BookOpen className="h-8 w-8 text-muted" aria-hidden="true" />
          <SectionEmptyState message={t("officer.noTraining")} />
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((row) => {
            const rowEvidence = evidenceById.get(row.id);
            return (
              <li key={row.id} className="rounded-lg border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{row.course || t("officer.trainingCourseNameUnavailable")}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {displayTrainingYear(row, rowEvidence?.completionDate ?? null, t("officer.trainingYearUnavailable"))}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted">{row.organization || t("officer.trainingProviderUnavailable")}</p>
                {row.notes ? <p className="mt-1 text-xs text-muted">{row.notes}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </EditableSectionCard>
  );
}
