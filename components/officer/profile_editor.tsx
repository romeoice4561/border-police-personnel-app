/**
 * ProfileEditor (Phase 23A — Officer Profile Workspace, Sections 2/5;
 * Phase 23B — rank preserves existing free-form value).
 *
 * The editable form for every field that lives directly on the Officer row:
 * rank, first/last name, current position (free text), current unit (Combobox
 * — existing units suggested but free text always allowed), phone, and the
 * contact channels (email/LINE/Facebook). Rendered in place of
 * BasicInformationSection + CareerSection + ContactSection when the workspace
 * is in edit mode.
 *
 * Phase 23B fix: rank was a fixed-option <Select> that blanked any imported
 * rank outside the standard list (e.g. "ร.ท."). It is now a Combobox so the
 * existing value is preserved while the standard ranks are still suggested.
 *
 * Pure controlled component over the ProfileDraft from useOfficerWorkspace.
 */
"use client";

import { Combobox } from "@/components/ui/combobox";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { RANK_OPTIONS } from "@/lib/officer_profile/rank_options";
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

export interface ProfileEditorProps {
  profile: ProfileDraft;
  onChange: (profile: ProfileDraft) => void;
  /** Existing unit names across all officers, for the Unit combobox's suggestions. */
  knownUnits: readonly string[];
}

export function ProfileEditor({ profile, onChange, knownUnits }: ProfileEditorProps) {
  function set<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    onChange({ ...profile, [key]: value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information &amp; Contact</CardTitle>
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
          <input
            id="edit-position"
            type="text"
            className={inputCls}
            placeholder="เช่น ผบ.ร้อย"
            value={profile.currentPosition}
            onChange={(e) => set("currentPosition", e.target.value)}
          />
        </Field>
        <Field label="หน่วย (กองร้อย/กองกำกับ/ภาค)">
          <Combobox
            value={profile.currentUnit}
            onChange={(value) => set("currentUnit", value)}
            suggestions={knownUnits}
            placeholder="พิมพ์หรือเลือกหน่วย"
            aria-label="หน่วย"
          />
        </Field>

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
        <Field label="Facebook URL" htmlFor="edit-facebookUrl">
          <input
            id="edit-facebookUrl"
            type="url"
            className={inputCls}
            placeholder="https://facebook.com/..."
            value={profile.facebookUrl}
            onChange={(e) => set("facebookUrl", e.target.value)}
          />
        </Field>
      </CardBody>
    </Card>
  );
}
