/**
 * EducationSection (Phase 21A — Editable Profile Foundation, Part 8;
 * Phase 23A — real Education data).
 *
 * Read-only Education card: lists each Education row (year, institution,
 * degree, notes) or the empty state when the officer has none. The editable
 * counterpart is EducationEditor, shown instead when the workspace is in
 * edit mode.
 */
"use client";

import { GraduationCap } from "lucide-react";
import type { Education } from "@/lib/database/query_types";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";
import { useT } from "@/components/i18n/language_provider";

export function EducationSection({ education }: { education: Education[] }) {
  const { t } = useT();
  return (
    <EditableSectionCard title={t("officer.education")}>
      {education.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <GraduationCap className="h-8 w-8 text-muted" aria-hidden="true" />
          <SectionEmptyState message={t("officer.noEducation")} />
        </div>
      ) : (
        <ul className="space-y-3">
          {education.map((row) => (
            <li key={row.id} className="rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{row.institution}</span>
                {row.year ? <span className="shrink-0 text-xs tabular-nums text-muted">{row.year}</span> : null}
              </div>
              {row.degree ? <p className="mt-0.5 text-sm text-muted">{row.degree}</p> : null}
              {row.notes ? <p className="mt-1 text-xs text-muted">{row.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </EditableSectionCard>
  );
}
