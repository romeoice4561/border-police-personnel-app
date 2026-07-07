/**
 * BasicInformationSection (Phase 21A — Editable Profile Foundation, Part 3).
 *
 * The officer's identity fields (rank, name, region, officer id), presented as
 * an editable-ready section. A missing field renders an explicit "—" (never
 * invented) — same convention as the existing OfficerProfileCard.
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { officerFullName } from "@/lib/ui/officer_summary";
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

export function BasicInformationSection({ officer }: { officer: OfficerWithRelations }) {
  return (
    <EditableSectionCard title="Basic Information">
      <dl className="grid grid-cols-2 gap-4">
        <Field label="Rank" value={officer.rank} />
        <Field label="Full name" value={officerFullName(officer)} />
        <Field label="Region" value={officer.region} />
        <Field label="Officer ID" value={officer.officerId} />
      </dl>
    </EditableSectionCard>
  );
}
