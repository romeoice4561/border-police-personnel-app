/**
 * CareerSection (Phase 21A — Editable Profile Foundation, Part 3).
 *
 * The officer's current position/unit/career-years, presented as an
 * editable-ready section (separate from BasicInformationSection so each
 * future edit action targets a focused set of fields).
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
import { calculateCareerYears, calculateYearsInRank, calculateYearsInPosition } from "@/lib/officer_profile/career_calculator";

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
  // Phase 26B Part 3/4 foundation: calculated live from the structured
  // Timeline dates (day/month/yearBE/isPresent/effectiveDate), independent
  // of the Phase 25 import pipeline's stored `officer.careerYears` estimate
  // (shown alongside, never replaced). Rows not yet migrated to the
  // structured model (no yearBE) simply don't contribute — 0 when none of
  // the timeline has been migrated yet, never a guess.
  const calculatedCareerYears = calculateCareerYears(officer.timeline);
  const yearsInRank = calculateYearsInRank(officer.timeline);
  const yearsInPosition = calculateYearsInPosition(officer.timeline);

  return (
    <EditableSectionCard title="Career">
      <dl className="grid grid-cols-2 gap-4">
        <Field label="Position" value={officer.currentPosition} />
        <Field label="Unit" value={officer.currentUnit} />
        <Field label="Career years (imported)" value={officer.careerYears} />
        <Field label="Career years (calculated)" value={calculatedCareerYears > 0 ? `${calculatedCareerYears} ปี` : "—"} />
        <Field label="Years in current rank" value={yearsInRank > 0 ? `${yearsInRank} ปี` : "—"} />
        <Field label="Years in current position" value={yearsInPosition > 0 ? `${yearsInPosition} ปี` : "—"} />
      </dl>
    </EditableSectionCard>
  );
}
