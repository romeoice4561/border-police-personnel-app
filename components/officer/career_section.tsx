/**
 * CareerSection (Phase 21A — Editable Profile Foundation, Part 3; Phase 26B
 * Part 5 Part B — corrected Career Years formula).
 *
 * The officer's current position/unit/career-years, presented as an
 * editable-ready section (separate from BasicInformationSection so each
 * future edit action targets a focused set of fields).
 */
import { Info } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
import { Tooltip } from "@/components/ui/tooltip";
import {
  calculateYearsInRank,
  calculateYearsInPosition,
  calculateCareerYearsSimple,
} from "@/lib/officer_profile/career_calculator";
import { currentYearBE } from "@/lib/officer_profile/thai_date";

function Field({ label, value, suffix }: { label: string; value: string | number | null | undefined; suffix?: React.ReactNode }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
        {display}
        {suffix}
      </dd>
    </div>
  );
}

export function CareerSection({ officer }: { officer: OfficerWithRelations }) {
  // Phase 26B Part 5 Part B: "Career Years (Calculated)" is ALWAYS current
  // Buddhist year minus the earliest timeline entry's Buddhist year (a plain
  // integer subtraction — see career_calculator.ts's
  // calculateCareerYearsSimple docstring for the spec's own worked
  // example). This NEVER uses the Phase 25 import pipeline's stored
  // `officer.careerYears` as the calculated value — that figure is shown
  // alongside, clearly labeled "(imported)", purely for comparison.
  const calculatedCareerYears = calculateCareerYearsSimple(officer.timeline, currentYearBE());
  const yearsInRank = calculateYearsInRank(officer.timeline);
  const yearsInPosition = calculateYearsInPosition(officer.timeline);

  const hasMismatch = calculatedCareerYears > 0 && officer.careerYears !== calculatedCareerYears;

  return (
    <EditableSectionCard title="Career">
      <dl className="grid grid-cols-2 gap-4">
        <Field label="Position" value={officer.currentPosition} />
        <Field label="Unit" value={officer.currentUnit} />
        <Field label="Career years (imported)" value={officer.careerYears} />
        <Field
          label="Career years (calculated)"
          value={calculatedCareerYears > 0 ? `${calculatedCareerYears} ปี` : "—"}
          suffix={
            hasMismatch ? (
              <Tooltip label="Imported value differs from calculated value.">
                <Info className="h-3.5 w-3.5 shrink-0 text-serious" aria-hidden="true" />
              </Tooltip>
            ) : null
          }
        />
        <Field label="Years in current rank" value={yearsInRank > 0 ? `${yearsInRank} ปี` : "—"} />
        <Field label="Years in current position" value={yearsInPosition > 0 ? `${yearsInPosition} ปี` : "—"} />
      </dl>
    </EditableSectionCard>
  );
}
