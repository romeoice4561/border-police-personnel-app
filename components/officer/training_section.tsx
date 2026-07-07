/**
 * TrainingSection (Phase 21A — Editable Profile Foundation, Part 9).
 *
 * Architecture + UI only. No training records exist in the schema yet, so
 * this always renders the empty state. Future support (documented, not
 * implemented): course, organization, hours, certificate.
 */
import { BookOpen } from "lucide-react";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";

/** Shape a future Training record is expected to take (not persisted yet — documentation only). */
export interface FutureTraining {
  id: string;
  course: string;
  organization: string | null;
  hours: number | null;
  certificateUrl: string | null;
}

export function TrainingSection() {
  return (
    <EditableSectionCard title="Training">
      <div className="flex flex-col items-center gap-2 py-2">
        <BookOpen className="h-8 w-8 text-muted" aria-hidden="true" />
        <SectionEmptyState message="No training courses yet." />
      </div>
    </EditableSectionCard>
  );
}
