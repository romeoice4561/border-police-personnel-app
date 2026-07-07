/**
 * NotesSection (Phase 21A — Editable Profile Foundation, Part 3).
 *
 * Free-form notes on the officer. No notes field exists in the schema yet, so
 * this always renders the empty state — architecture + UI only.
 */
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";

export function NotesSection() {
  return (
    <EditableSectionCard title="Notes">
      <SectionEmptyState message="No notes yet." />
    </EditableSectionCard>
  );
}
