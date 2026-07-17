/**
 * PersonalInformationSection (Phase 26B Part 5 Part G/O; Phase 26B Part 6
 * Part E — reorganized into logical groups; Phase 44 Task 9 — removed
 * Current Age and the Retirement group, now fully covered by the dedicated
 * OfficerPersonalTimelineCard/OfficerRetirementIntelligenceCard Intelligence
 * cards on this page, so the same value is never shown twice).
 *
 * Read-only display of the officer's Personal Information, grouped into
 * Identity / Personal / Family / Residence / Health / Uniform (Part E)
 * rather than one flat grid — the same fields as before, just organized so
 * a reader can scan by category instead of an undifferentiated list. Every
 * field is genuinely optional — a missing value renders "—" (never
 * invented). BMI is AUTO-CALCULATED here for display only, never persisted
 * (there is no Officer.bmi column — recomputing on every read guarantees
 * the displayed value can never drift from its inputs). Date of birth
 * itself remains here (factual Master Data), formatted via the canonical
 * Thai date formatter (Task 9 — "11 ส.ค. 2528", never "11/08/2528").
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
import { BilingualLabel } from "@/components/ui/bilingual_label";
import { FIELD_LABELS } from "@/lib/i18n/bilingual_label";
import { calculateBmi } from "@/lib/officer_profile/retirement_calculator";
import { formatFullThaiDateTh } from "@/lib/intelligence/shared/thai_date";

function Field({ labelKey, value }: { labelKey: keyof typeof FIELD_LABELS; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <BilingualLabel text={FIELD_LABELS[labelKey]} className="text-xs uppercase tracking-wide text-muted" />
      <dd className="mt-0.5 text-sm font-medium text-foreground">{display}</dd>
    </div>
  );
}

/** A labeled sub-group within the Personal Information card (Part E: Identity/Personal/Family/Residence/Health/Uniform/Retirement). */
function Group({ titleTh, titleEn, children }: { titleTh: string; titleEn: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-accent">
        {titleTh} <span className="text-muted/70">/ {titleEn}</span>
      </h3>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">{children}</dl>
    </div>
  );
}

export function PersonalInformationSection({ officer }: { officer: OfficerWithRelations }) {
  const bmi = calculateBmi(officer.weightKg ?? null, officer.heightCm ?? null);

  return (
    <EditableSectionCard title="ข้อมูลส่วนบุคคล / Personal Information">
      <div className="space-y-5">
        <Group titleTh="ข้อมูลประจำตัว" titleEn="Identity">
          <Field labelKey="citizenId" value={officer.citizenId} />
          <Field labelKey="passportNumber" value={officer.passportNumber} />
          <Field labelKey="employeeNumber" value={officer.employeeNumber} />
        </Group>

        <Group titleTh="ข้อมูลส่วนตัว" titleEn="Personal">
          <Field labelKey="dateOfBirth" value={officer.dateOfBirth ? formatFullThaiDateTh(officer.dateOfBirth) : null} />
          <Field labelKey="nickname" value={officer.nickname} />
          <Field labelKey="bloodGroup" value={officer.bloodGroup} />
          <Field labelKey="rh" value={officer.rh} />
          <Field labelKey="nationality" value={officer.nationality} />
          <Field labelKey="religion" value={officer.religion} />
        </Group>

        <Group titleTh="ครอบครัว" titleEn="Family">
          <Field labelKey="maritalStatus" value={officer.maritalStatus} />
          <Field labelKey="children" value={officer.children} />
        </Group>

        <Group titleTh="ที่อยู่อาศัย" titleEn="Residence">
          <Field labelKey="homeProvince" value={officer.homeProvince} />
          <Field labelKey="currentProvince" value={officer.currentProvince} />
          <Field labelKey="addressSummary" value={officer.addressSummary} />
        </Group>

        <Group titleTh="สุขภาพ" titleEn="Health">
          <Field labelKey="height" value={officer.heightCm} />
          <Field labelKey="weight" value={officer.weightKg} />
          <Field labelKey="bmi" value={bmi} />
        </Group>

        <Group titleTh="เครื่องแบบ" titleEn="Uniform">
          <Field labelKey="shirtSize" value={officer.shirtSize} />
          <Field labelKey="jacketSize" value={officer.jacketSize} />
          <Field labelKey="uniformShoeSize" value={officer.uniformShoeSize} />
          <Field labelKey="hatSize" value={officer.hatSize} />
        </Group>
      </div>
    </EditableSectionCard>
  );
}
