/**
 * NotesSection (Phase 21A — Editable Profile Foundation, Part 3).
 *
 * Free-form notes on the officer. No notes field exists in the schema yet, so
 * this always renders the empty state — architecture + UI only.
 */
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";
import { useT } from "@/components/i18n/language_provider";

export function NotesSection() {
  const { t } = useT();
  return (
    <EditableSectionCard title={t("officer.notes")}>
      <SectionEmptyState message={t("officer.notesEmpty")} />
    </EditableSectionCard>
  );
}
