/**
 * EducationSection (Phase 21A — Editable Profile Foundation, Part 8).
 *
 * Architecture + UI only. No education records exist in the schema yet, so
 * this always renders the empty state. Future support (documented, not
 * implemented): degree, major, institution, graduation year.
 */
import { GraduationCap } from "lucide-react";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";

/** Shape a future Education record is expected to take (not persisted yet — documentation only). */
export interface FutureEducation {
  id: string;
  degree: string;
  major: string | null;
  institution: string;
  graduationYear: number | null;
}

export function EducationSection() {
  return (
    <EditableSectionCard title="Education">
      <div className="flex flex-col items-center gap-2 py-2">
        <GraduationCap className="h-8 w-8 text-muted" aria-hidden="true" />
        <SectionEmptyState message="No education records yet." />
      </div>
    </EditableSectionCard>
  );
}
