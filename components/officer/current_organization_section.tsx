/**
 * CurrentOrganizationSection (Phase 26B Part 5 Part C/I; Phase 26B Part 6
 * Part C — "Not Assigned" empty state).
 *
 * Read-only display of the officer's structured Current Organization —
 * Headquarters -> Border Patrol Division -> Battalion -> Company — resolved
 * from the officer's headquartersId/regionId/battalionId/companyId against
 * the org tree snapshot. Positioned immediately below Current Position (Part
 * I), replacing the old free-text Unit display.
 *
 * Phase 26B Part 6 Part C: a per-level "—" for every one of the 4 fields
 * read as if the section were broken/empty by design ("- / - / - / -"). When
 * NONE of the 4 levels resolve, the whole section now shows one clear
 * "ยังไม่ได้ระบุ / Not Assigned" empty state instead; when SOME levels resolve
 * (a partially-linked officer), each unresolved level still shows "—"
 * individually so it's clear which levels are missing.
 */
import { Building2 } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";
import { BilingualLabel } from "@/components/ui/bilingual_label";
import { FIELD_LABELS } from "@/lib/i18n/bilingual_label";

function Field({ labelKey, value }: { labelKey: keyof typeof FIELD_LABELS; value: string | null }) {
  return (
    <div>
      <BilingualLabel text={FIELD_LABELS[labelKey]} className="text-xs uppercase tracking-wide text-muted" />
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}

export function CurrentOrganizationSection({ officer, organizationEngine }: { officer: OfficerWithRelations; organizationEngine: OrganizationEngine }) {
  const labels = organizationEngine.resolveLabels({
    headquartersId: officer.headquartersId ?? null,
    regionId: officer.regionId ?? null,
    battalionId: officer.battalionId ?? null,
    companyId: officer.companyId ?? null,
  });

  const isUnassigned = !labels.headquarters && !labels.borderPatrolDivision && !labels.battalion && !labels.company;

  return (
    <EditableSectionCard title="หน่วยงานปัจจุบัน / Current Organization">
      {isUnassigned ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <Building2 className="h-8 w-8 text-muted" aria-hidden="true" />
          <SectionEmptyState message="ยังไม่ได้ระบุหน่วยงาน / Not Assigned" />
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field labelKey="headquarters" value={labels.headquarters} />
          <Field labelKey="borderPatrolDivision" value={labels.borderPatrolDivision} />
          <Field labelKey="battalion" value={labels.battalion} />
          <Field labelKey="company" value={labels.company} />
        </dl>
      )}
    </EditableSectionCard>
  );
}
