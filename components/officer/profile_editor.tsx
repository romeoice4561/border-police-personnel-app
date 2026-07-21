/**
 * ProfileEditor (Phase 23A — Officer Profile Workspace, Sections 2/5;
 * Phase 23B — rank preserves existing free-form value; Phase 26B Part 5 Part
 * C/I — structured Current Organization hierarchy replaces the free-text
 * Unit field).
 *
 * The editable form for every field that lives directly on the Officer row:
 * rank, first/last name, current position (free text), the structured
 * Current Organization hierarchy (Headquarters/Division/Battalion/Company —
 * Part C/I, immediately below Current Position), phone, and the contact
 * channels (email/LINE/Facebook/nickname), all in this ONE section — no
 * separate card. Rendered in place of BasicInformationSection +
 * CareerSection + ContactSection when the workspace is in edit mode.
 *
 * Phase 23B fix: rank was a fixed-option <Select> that blanked any imported
 * rank outside the standard list (e.g. "ร.ท."). It is now a Combobox so the
 * existing value is preserved while the standard ranks are still suggested.
 *
 * Phase 26B Part 5 Part C: the old free-text "หน่วย" Combobox is REMOVED —
 * OrgHierarchyPicker is the only way to set the officer's current
 * organization now. The legacy `currentUnit` text is still derived and sent
 * (see useOfficerWorkspace's save()) so every reader that hasn't been
 * migrated to the structured fields keeps showing an accurate value.
 *
 * Pure controlled component over the ProfileDraft from useOfficerWorkspace.
 */
"use client";

import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { BilingualLabel } from "@/components/ui/bilingual_label";
import { useT } from "@/components/i18n/language_provider";
import { FIELD_LABELS } from "@/lib/i18n/bilingual_label";
import { ACADEMY_CLASS_OPTIONS } from "@/lib/officer_profile/academy_class_options";
import { TRI_STATE_LABELS } from "@/lib/officer_profile/tri_state";
import { RANK_OPTIONS } from "@/lib/officer_profile/rank_options";
import { POSITION_OPTIONS } from "@/lib/officer_profile/position_options";
import { BLOOD_GROUP_OPTIONS } from "@/lib/officer_profile/blood_group_options";
import { RH_OPTIONS } from "@/lib/officer_profile/rh_options";
import { MARITAL_STATUS_OPTIONS } from "@/lib/officer_profile/marital_status_options";
import { SHIRT_SIZE_OPTIONS } from "@/lib/officer_profile/shirt_size_options";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { NATIONALITY_OPTIONS } from "@/lib/officer_profile/nationality_options";
import { RELIGION_OPTIONS } from "@/lib/officer_profile/religion_options";
import { EDUCATION_LEVEL_OPTIONS } from "@/lib/officer_profile/education_level_options";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { OrgHierarchyPicker, type OrgHierarchyValue } from "@/components/officer/org_hierarchy_picker";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import type { ProfileDraft } from "@/components/officer/use_officer_workspace";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Phase 26B Part 5 Part K: a Field variant whose label goes through the shared BilingualLabel primitive, for new Part G/O fields. */
function BilingualField({ labelKey, htmlFor, children }: { labelKey: keyof typeof FIELD_LABELS; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <BilingualLabel text={FIELD_LABELS[labelKey]} htmlFor={htmlFor} />
      {children}
    </div>
  );
}

export interface ProfileEditorProps {
  profile: ProfileDraft;
  onChange: (profile: ProfileDraft) => void;
  /** Existing unit names across all officers — no longer used by this editor (Part C removed the free-text Unit field) but kept in the prop signature so callers passing it are unaffected. */
  knownUnits: readonly string[];
  /** Phase 27: the shared OrganizationEngine, for the Current Organization hierarchy picker. */
  organizationEngine: OrganizationEngine;
}

export function ProfileEditor({ profile, onChange, organizationEngine }: ProfileEditorProps) {
  const { t, language } = useT();
  const unspecifiedLabel = language === "en" ? TRI_STATE_LABELS.unspecified.en : TRI_STATE_LABELS.unspecified.th;

  function set<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    onChange({ ...profile, [key]: value });
  }

  const orgValue: OrgHierarchyValue = {
    headquartersId: profile.headquartersId,
    headquartersText: profile.headquartersText,
    regionId: profile.regionId,
    regionText: profile.regionText,
    battalionId: profile.battalionId,
    battalionText: profile.battalionText,
    companyId: profile.companyId,
    companyText: profile.companyText,
  };

  function onOrgChange(next: OrgHierarchyValue) {
    onChange({ ...profile, ...next });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("officer.basicInformationAndContact")}</CardTitle>
      </CardHeader>
      <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="ยศ" htmlFor="edit-rank">
          <Combobox
            id="edit-rank"
            value={profile.rank}
            onChange={(value) => set("rank", value)}
            suggestions={RANK_OPTIONS}
            placeholder="เลือกหรือพิมพ์ยศ"
            aria-label="ยศ"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ชื่อ" htmlFor="edit-firstName">
            <input
              id="edit-firstName"
              type="text"
              className={inputCls}
              value={profile.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </Field>
          <Field label="นามสกุล" htmlFor="edit-lastName">
            <input
              id="edit-lastName"
              type="text"
              className={inputCls}
              value={profile.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </Field>
        </div>

        <Field label="ตำแหน่ง" htmlFor="edit-position">
          <Combobox
            id="edit-position"
            value={profile.currentPosition}
            onChange={(value) => set("currentPosition", value)}
            suggestions={POSITION_OPTIONS}
            placeholder="เลือกหรือพิมพ์ตำแหน่ง"
            aria-label="ตำแหน่ง"
          />
        </Field>

        {/* Phase 26B Part 5 Part C/I: Current Organization sits immediately
            below Current Position, spans the full width (4 comboboxes side
            by side on desktop), and is followed by Phone/Email/LINE/
            Facebook/Nickname in this SAME section — not a separate card. */}
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-medium text-muted">หน่วยงานปัจจุบัน (Current Organization)</p>
          <OrgHierarchyPicker organizationEngine={organizationEngine} value={orgValue} onChange={onOrgChange} />
        </div>

        <Field label="เบอร์โทร" htmlFor="edit-phone">
          <input
            id="edit-phone"
            type="tel"
            className={inputCls}
            placeholder="เช่น 081-234-5678"
            value={profile.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label="Email" htmlFor="edit-email">
          <input
            id="edit-email"
            type="email"
            className={inputCls}
            placeholder="name@example.com"
            value={profile.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <Field label="LINE ID" htmlFor="edit-lineId">
          <input
            id="edit-lineId"
            type="text"
            className={inputCls}
            value={profile.lineId}
            onChange={(e) => set("lineId", e.target.value)}
          />
        </Field>
        <BilingualField labelKey="facebookUrl" htmlFor="edit-facebookUrl">
          <input
            id="edit-facebookUrl"
            type="url"
            className={inputCls}
            placeholder="https://facebook.com/..."
            value={profile.facebookUrl}
            onChange={(e) => set("facebookUrl", e.target.value)}
          />
        </BilingualField>
        <BilingualField labelKey="nickname" htmlFor="edit-nickname">
          <input
            id="edit-nickname"
            type="text"
            className={inputCls}
            value={profile.nickname}
            onChange={(e) => set("nickname", e.target.value)}
          />
        </BilingualField>
        <BilingualField labelKey="academyClass" htmlFor="edit-academyClass">
          <Select
            id="edit-academyClass"
            options={ACADEMY_CLASS_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            placeholder={unspecifiedLabel}
            value={profile.academyClass}
            onChange={(e) => set("academyClass", e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">{t("officer.academyClassPlaceholder")}</p>
        </BilingualField>
      </CardBody>
    </Card>
  );
}

/**
 * Phase 26B Part 5 Part G/O: Personal Information + optional additional
 * fields, as its own card (mirrors the read-only PersonalInformationSection
 * being its own card) — kept separate from ProfileEditor's Basic
 * Information & Contact card rather than growing that one indefinitely.
 */
export function PersonalInformationEditor({ profile, onChange }: { profile: ProfileDraft; onChange: (profile: ProfileDraft) => void }) {
  function set<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    onChange({ ...profile, [key]: value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ข้อมูลส่วนบุคคล / Personal Information</CardTitle>
      </CardHeader>
      <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BilingualField labelKey="dateOfBirth" htmlFor="edit-dateOfBirth">
          <ThaiDatePicker
            id="edit-dateOfBirth"
            value={profile.dateOfBirth}
            onChange={(value) => set("dateOfBirth", value)}
            rejectFuture
            placeholder="เลือกวันเกิด (พ.ศ.)"
            aria-label="วันเกิด"
          />
        </BilingualField>
        <BilingualField labelKey="bloodGroup" htmlFor="edit-bloodGroup">
          <Select
            id="edit-bloodGroup"
            options={BLOOD_GROUP_OPTIONS.map((v) => ({ value: v, label: v }))}
            placeholder="— ไม่ระบุ —"
            value={profile.bloodGroup}
            onChange={(e) => set("bloodGroup", e.target.value)}
          />
        </BilingualField>
        <BilingualField labelKey="rh" htmlFor="edit-rh">
          <Select
            id="edit-rh"
            options={RH_OPTIONS.map((v) => ({ value: v, label: v }))}
            placeholder="— ไม่ระบุ —"
            value={profile.rh}
            onChange={(e) => set("rh", e.target.value)}
          />
        </BilingualField>
        <BilingualField labelKey="maritalStatus" htmlFor="edit-maritalStatus">
          <Select
            id="edit-maritalStatus"
            options={MARITAL_STATUS_OPTIONS.map((v) => ({ value: v, label: v }))}
            placeholder="— ไม่ระบุ —"
            value={profile.maritalStatus}
            onChange={(e) => set("maritalStatus", e.target.value)}
          />
        </BilingualField>
        <BilingualField labelKey="children" htmlFor="edit-children">
          <input
            id="edit-children"
            type="number"
            min="0"
            className={inputCls}
            value={profile.children}
            onChange={(e) => set("children", e.target.value)}
          />
        </BilingualField>
        <BilingualField labelKey="homeProvince" htmlFor="edit-homeProvince">
          <Combobox
            id="edit-homeProvince"
            value={profile.homeProvince}
            onChange={(value) => set("homeProvince", value)}
            suggestions={THAI_PROVINCE_OPTIONS}
            placeholder="เลือกหรือพิมพ์จังหวัด"
            aria-label="จังหวัดภูมิลำเนา"
          />
        </BilingualField>
        <BilingualField labelKey="shirtSize" htmlFor="edit-shirtSize">
          <Combobox
            id="edit-shirtSize"
            value={profile.shirtSize}
            onChange={(value) => set("shirtSize", value)}
            suggestions={SHIRT_SIZE_OPTIONS}
            placeholder="เลือกหรือพิมพ์ขนาด"
            aria-label="ขนาดเสื้อ"
          />
        </BilingualField>
        <BilingualField labelKey="nationality" htmlFor="edit-nationality">
          <Combobox
            id="edit-nationality"
            value={profile.nationality}
            onChange={(value) => set("nationality", value)}
            suggestions={NATIONALITY_OPTIONS}
            placeholder="เลือกหรือพิมพ์สัญชาติ"
            aria-label="สัญชาติ"
          />
        </BilingualField>

        {/* Phase 26B Part 5 Part O — optional additional fields. */}
        <BilingualField labelKey="citizenId" htmlFor="edit-citizenId">
          <input id="edit-citizenId" type="text" className={inputCls} value={profile.citizenId} onChange={(e) => set("citizenId", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="passportNumber" htmlFor="edit-passportNumber">
          <input id="edit-passportNumber" type="text" className={inputCls} value={profile.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="employeeNumber" htmlFor="edit-employeeNumber">
          <input id="edit-employeeNumber" type="text" className={inputCls} value={profile.employeeNumber} onChange={(e) => set("employeeNumber", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="emergencyContact" htmlFor="edit-emergencyContact">
          <input id="edit-emergencyContact" type="text" className={inputCls} value={profile.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="emergencyPhone" htmlFor="edit-emergencyPhone">
          <input id="edit-emergencyPhone" type="tel" className={inputCls} value={profile.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="currentProvince" htmlFor="edit-currentProvince">
          <Combobox
            id="edit-currentProvince"
            value={profile.currentProvince}
            onChange={(value) => set("currentProvince", value)}
            suggestions={THAI_PROVINCE_OPTIONS}
            placeholder="เลือกหรือพิมพ์จังหวัด"
            aria-label="จังหวัดที่อยู่ปัจจุบัน"
          />
        </BilingualField>
        <BilingualField labelKey="addressSummary" htmlFor="edit-addressSummary">
          <input id="edit-addressSummary" type="text" className={inputCls} value={profile.addressSummary} onChange={(e) => set("addressSummary", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="religion" htmlFor="edit-religion">
          <Select
            id="edit-religion"
            options={RELIGION_OPTIONS.map((v) => ({ value: v, label: v }))}
            placeholder="— ไม่ระบุ —"
            value={profile.religion}
            onChange={(e) => set("religion", e.target.value)}
          />
        </BilingualField>
        <BilingualField labelKey="educationLevel" htmlFor="edit-educationLevel">
          <Select
            id="edit-educationLevel"
            options={EDUCATION_LEVEL_OPTIONS.map((v) => ({ value: v, label: v }))}
            placeholder="— ไม่ระบุ —"
            value={profile.educationLevel}
            onChange={(e) => set("educationLevel", e.target.value)}
          />
        </BilingualField>
        <BilingualField labelKey="weight" htmlFor="edit-weightKg">
          <input id="edit-weightKg" type="number" min="0" step="0.1" className={inputCls} value={profile.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="height" htmlFor="edit-heightCm">
          <input id="edit-heightCm" type="number" min="0" step="0.1" className={inputCls} value={profile.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="uniformShoeSize" htmlFor="edit-uniformShoeSize">
          <input id="edit-uniformShoeSize" type="text" className={inputCls} value={profile.uniformShoeSize} onChange={(e) => set("uniformShoeSize", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="hatSize" htmlFor="edit-hatSize">
          <input id="edit-hatSize" type="text" className={inputCls} value={profile.hatSize} onChange={(e) => set("hatSize", e.target.value)} />
        </BilingualField>
        <BilingualField labelKey="jacketSize" htmlFor="edit-jacketSize">
          <input id="edit-jacketSize" type="text" className={inputCls} value={profile.jacketSize} onChange={(e) => set("jacketSize", e.target.value)} />
        </BilingualField>
      </CardBody>
    </Card>
  );
}
