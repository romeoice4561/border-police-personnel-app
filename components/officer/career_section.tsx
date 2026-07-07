/**
 * CareerSection (Phase 21A — Editable Profile Foundation, Part 3).
 *
 * The officer's current position/unit/career-years, presented as an
 * editable-ready section (separate from BasicInformationSection so each
 * future edit action targets a focused set of fields).
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{display}</dd>
    </div>
  );
}

export function CareerSection({ officer }: { officer: OfficerWithRelations }) {
  return (
    <EditableSectionCard title="Career">
      <dl className="grid grid-cols-2 gap-4">
        <Field label="Position" value={officer.currentPosition} />
        <Field label="Unit" value={officer.currentUnit} />
        <Field label="Career years" value={officer.careerYears} />
      </dl>
    </EditableSectionCard>
  );
}
