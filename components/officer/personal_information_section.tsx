/**
 * PersonalInformationSection (Phase 26B Part 5 Part G/O).
 *
 * Read-only display of the officer's Personal Information (Part G: Date of
 * Birth/Nickname/Blood Group/Rh/Marital Status/Children/Home Province/Shirt
 * Size/Nationality) plus the optional additional fields (Part O: Citizen
 * ID/Passport/Employee Number/Retirement Year+Countdown/Emergency Contact+
 * Phone/Address Summary/Current Province/Religion/Education Level/Weight/
 * Height/BMI/Uniform Shoe Size/Hat Size/Jacket Size). Every field is
 * genuinely optional — a missing value renders "—" (never invented). BMI and
 * Retirement Year/Countdown are AUTO-CALCULATED here for display only, never
 * persisted (Part O: "Retirement Year (Auto Calculated)", "BMI (Auto)").
 */
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
import { BilingualLabel } from "@/components/ui/bilingual_label";
import { FIELD_LABELS } from "@/lib/i18n/bilingual_label";
import { yearGregorianToBE } from "@/lib/officer_profile/thai_date";
import { calculateBmi, calculateRetirementYearBE } from "@/lib/officer_profile/retirement_calculator";

function Field({ labelKey, value }: { labelKey: keyof typeof FIELD_LABELS; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <BilingualLabel text={FIELD_LABELS[labelKey]} className="text-xs uppercase tracking-wide text-muted" />
      <dd className="mt-0.5 text-sm font-medium text-foreground">{display}</dd>
    </div>
  );
}

/** "1 มกราคม 2560" formatted from a persisted Gregorian Date, in Buddhist Era — consistent with the rest of the workspace's date display convention. */
function formatDateOfBirth(date: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const yearBE = yearGregorianToBE(d.getUTCFullYear());
  const THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  return `${day} ${THAI_MONTHS[month]} ${yearBE}`;
}

export function PersonalInformationSection({ officer }: { officer: OfficerWithRelations }) {
  const bmi = calculateBmi(officer.weightKg ?? null, officer.heightCm ?? null);
  const retirement = calculateRetirementYearBE(officer.dateOfBirth ?? null);

  return (
    <EditableSectionCard title="ข้อมูลส่วนบุคคล / Personal Information">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field labelKey="dateOfBirth" value={formatDateOfBirth(officer.dateOfBirth ?? null)} />
        <Field labelKey="nickname" value={officer.nickname} />
        <Field labelKey="bloodGroup" value={officer.bloodGroup} />
        <Field labelKey="rh" value={officer.rh} />
        <Field labelKey="maritalStatus" value={officer.maritalStatus} />
        <Field labelKey="children" value={officer.children} />
        <Field labelKey="homeProvince" value={officer.homeProvince} />
        <Field labelKey="shirtSize" value={officer.shirtSize} />
        <Field labelKey="nationality" value={officer.nationality} />

        <Field labelKey="citizenId" value={officer.citizenId} />
        <Field labelKey="passportNumber" value={officer.passportNumber} />
        <Field labelKey="employeeNumber" value={officer.employeeNumber} />
        <Field labelKey="retirementYear" value={retirement ? retirement.retirementYearBE : null} />
        <Field labelKey="retirementCountdown" value={retirement ? `${retirement.yearsRemaining} ปี` : null} />
        <Field labelKey="emergencyContact" value={officer.emergencyContact} />
        <Field labelKey="emergencyPhone" value={officer.emergencyPhone} />
        <Field labelKey="addressSummary" value={officer.addressSummary} />
        <Field labelKey="currentProvince" value={officer.currentProvince} />
        <Field labelKey="religion" value={officer.religion} />
        <Field labelKey="educationLevel" value={officer.educationLevel} />
        <Field labelKey="weight" value={officer.weightKg} />
        <Field labelKey="height" value={officer.heightCm} />
        <Field labelKey="bmi" value={bmi} />
        <Field labelKey="uniformShoeSize" value={officer.uniformShoeSize} />
        <Field labelKey="hatSize" value={officer.hatSize} />
        <Field labelKey="jacketSize" value={officer.jacketSize} />
      </dl>
    </EditableSectionCard>
  );
}
