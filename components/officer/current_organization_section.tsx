/**
 * CurrentOrganizationSection (Phase 26B Part 5 Part C/I).
 *
 * Read-only display of the officer's structured Current Organization —
 * Headquarters -> Border Patrol Division -> Battalion -> Company — resolved
 * from the officer's headquartersId/regionId/battalionId/companyId against
 * the org tree snapshot. Positioned immediately below Current Position (Part
 * I), replacing the old free-text Unit display. A level with no resolved id
 * yet renders "—" (never invented/guessed from the legacy `currentUnit` text).
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { resolveOrgLabels, type OrgTree } from "@/lib/organization/org_tree";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
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

export function CurrentOrganizationSection({ officer, orgTree }: { officer: OfficerWithRelations; orgTree: OrgTree }) {
  const labels = resolveOrgLabels(orgTree, {
    headquartersId: officer.headquartersId ?? null,
    regionId: officer.regionId ?? null,
    battalionId: officer.battalionId ?? null,
    companyId: officer.companyId ?? null,
  });

  return (
    <EditableSectionCard title="หน่วยงานปัจจุบัน / Current Organization">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field labelKey="headquarters" value={labels.headquarters} />
        <Field labelKey="borderPatrolDivision" value={labels.borderPatrolDivision} />
        <Field labelKey="battalion" value={labels.battalion} />
        <Field labelKey="company" value={labels.company} />
      </dl>
    </EditableSectionCard>
  );
}
