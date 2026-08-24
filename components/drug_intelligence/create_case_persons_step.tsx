/**
 * Create Case — Persons step (Phase DI-1 Round 2, Section 8/9/10/11;
 * DI-7.2: added nickname/sex/approximateAge/networkMemberships;
 * DI-7.3: added networkRoles with provenance + verification status).
 *
 * Progressive disclosure: identity fields first, then aliases, then
 * procedural role, then network role assertions, then network memberships,
 * then identifiers/phones/SIMs/devices/vehicles.
 */
"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { Field, HelperText, inputCls } from "@/components/drug_intelligence/create_case_field";
import { DrugPersonMatchCard } from "@/components/drug_intelligence/drug_person_match_card";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import { useDrugPersonMatchCandidates } from "@/components/drug_intelligence/use_person_match_candidates";
import { usePhoneReuseSignal, useDeviceReuseSignal, useVehicleReuseSignal } from "@/components/drug_intelligence/use_reuse_indicators";
import { DrugAlertInlineCard } from "@/components/drug_intelligence/drug_alert_inline_card";
import { DRUG_CASE_PERSON_ROLES, DRUG_PERSON_IDENTIFIER_TYPES, DRUG_PERSON_SEX_OPTIONS, DRUG_PERSON_SEX_LABELS, DRUG_NETWORK_ROLES, DRUG_NETWORK_ROLE_LABELS, DRUG_NETWORK_ROLE_SOURCES, DRUG_NETWORK_ROLE_SOURCE_LABELS, DRUG_NETWORK_ROLE_VERIFICATION_STATUSES, DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS } from "@/lib/drug_intelligence/drug_person_options";
import {
  createEmptyPersonDraft,
  createEmptyAliasDraft,
  createEmptyNetworkRoleDraft,
  createEmptyNetworkMembershipDraft,
  nextDraftKey,
  type PersonDraft,
  type PhoneDraft,
  type SimDraft,
  type DeviceDraft,
  type VehicleDraft,
  type NetworkRoleDraft,
  type NetworkMembershipDraft,
} from "@/lib/drug_intelligence/create_case_draft";

const NATIONALITY_SUGGESTIONS = ["ไทย", "เมียนมา", "ลาว", "กัมพูชา", "เวียดนาม", "จีน"];
const VEHICLE_TYPE_SUGGESTIONS = ["รถยนต์", "รถกระบะ", "รถจักรยานยนต์", "รถบรรทุก", "รถตู้"];

function emptyPhone(): PhoneDraft {
  return { key: nextDraftKey(), rawInput: "", firstSeenAt: "", lastSeenAt: "", notes: "" };
}
function emptySim(): SimDraft {
  return { key: nextDraftKey(), iccid: "", imsi: "", carrier: "", firstSeenAt: "", lastSeenAt: "", notes: "" };
}
function emptyDevice(): DeviceDraft {
  return { key: nextDraftKey(), brand: "", model: "", serialNumber: "", imei1: "", imei2: "", firstSeenAt: "", lastSeenAt: "", notes: "" };
}
function emptyVehicle(): VehicleDraft {
  return {
    key: nextDraftKey(),
    registrationNumber: "",
    registrationProvince: "",
    vehicleType: "",
    brand: "",
    model: "",
    color: "",
    vin: "",
    firstSeenAt: "",
    lastSeenAt: "",
    notes: "",
  };
}

export function CreateCasePersonsStep({ persons, onChange }: { persons: PersonDraft[]; onChange: (persons: PersonDraft[]) => void }) {
  const { t } = useT();

  function updatePerson(index: number, patch: Partial<PersonDraft>) {
    onChange(persons.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  function removePerson(index: number) {
    onChange(persons.filter((_, i) => i !== index));
  }
  function addPerson() {
    onChange([...persons, createEmptyPersonDraft()]);
  }

  return (
    <div className="space-y-4">
      {persons.map((person, index) => (
        <PersonCard key={person.key} person={person} index={index} onChange={(patch) => updatePerson(index, patch)} onRemove={() => removePerson(index)} />
      ))}
      <Button type="button" variant="outline" onClick={addPerson}>
        {t("di.person.addPerson")}
      </Button>
    </div>
  );
}

function PersonCard({ person, index, onChange, onRemove }: { person: PersonDraft; index: number; onChange: (patch: Partial<PersonDraft>) => void; onRemove: () => void }) {
  const { t, language } = useT();
  const { user } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const roleOptions = DRUG_CASE_PERSON_ROLES.map((r) => ({ value: r, label: t(`di.role.${r}`) }));
  const identifierTypeOptions = DRUG_PERSON_IDENTIFIER_TYPES.map((it) => ({ value: it, label: t(`di.identifierType.${it}`) }));
  const sexOptions = [
    { value: "", label: t("common.pleaseSelect") },
    ...DRUG_PERSON_SEX_OPTIONS.map((s) => ({
      value: s,
      label: language === "th" ? DRUG_PERSON_SEX_LABELS[s].labelTh : DRUG_PERSON_SEX_LABELS[s].labelEn,
    })),
  ];
  const networkRoleOptions = DRUG_NETWORK_ROLES.map((r) => ({
    value: r,
    label: language === "th" ? DRUG_NETWORK_ROLE_LABELS[r].labelTh : DRUG_NETWORK_ROLE_LABELS[r].labelEn,
  }));
  const sourceOptions = [
    { value: "", label: t("common.pleaseSelect") },
    ...DRUG_NETWORK_ROLE_SOURCES.map((s) => ({
      value: s,
      label: language === "th" ? DRUG_NETWORK_ROLE_SOURCE_LABELS[s].labelTh : DRUG_NETWORK_ROLE_SOURCE_LABELS[s].labelEn,
    })),
  ];
  const verificationOptions = DRUG_NETWORK_ROLE_VERIFICATION_STATUSES.map((v) => ({
    value: v,
    label: language === "th" ? DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[v].labelTh : DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[v].labelEn,
  }));

  const duplicateCheck = useDrugPersonMatchCandidates(user?.id ?? null, {
    primaryFullName: person.primaryFullName,
    dateOfBirth: person.dateOfBirth || null,
    identifiers: person.identifiers.map((i) => ({ type: i.type, value: i.value })),
  });

  const showDuplicateWarning = !person.existingPersonId && duplicateCheck.candidates.length > 0;

  function addIdentifier() {
    onChange({ identifiers: [...person.identifiers, { key: nextDraftKey(), type: "THAI_ID", value: "", notes: "" }] });
  }
  function updateIdentifier(idx: number, patch: Partial<PersonDraft["identifiers"][number]>) {
    onChange({ identifiers: person.identifiers.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  }
  function removeIdentifier(idx: number) {
    onChange({ identifiers: person.identifiers.filter((_, i) => i !== idx) });
  }

  function addPhone() {
    onChange({ phones: [...person.phones, emptyPhone()] });
  }
  function updatePhone(idx: number, patch: Partial<PhoneDraft>) {
    onChange({ phones: person.phones.map((p, i) => (i === idx ? { ...p, ...patch } : p)) });
  }
  function removePhone(idx: number) {
    onChange({ phones: person.phones.filter((_, i) => i !== idx) });
  }

  function addSim() {
    onChange({ sims: [...person.sims, emptySim()] });
  }
  function updateSim(idx: number, patch: Partial<SimDraft>) {
    onChange({ sims: person.sims.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  }
  function removeSim(idx: number) {
    onChange({ sims: person.sims.filter((_, i) => i !== idx) });
  }

  function addDevice() {
    onChange({ devices: [...person.devices, emptyDevice()] });
  }
  function updateDevice(idx: number, patch: Partial<DeviceDraft>) {
    onChange({ devices: person.devices.map((d, i) => (i === idx ? { ...d, ...patch } : d)) });
  }
  function removeDevice(idx: number) {
    onChange({ devices: person.devices.filter((_, i) => i !== idx) });
  }

  function addVehicle() {
    onChange({ vehicles: [...person.vehicles, emptyVehicle()] });
  }
  function updateVehicle(idx: number, patch: Partial<VehicleDraft>) {
    onChange({ vehicles: person.vehicles.map((v, i) => (i === idx ? { ...v, ...patch } : v)) });
  }
  function removeVehicle(idx: number) {
    onChange({ vehicles: person.vehicles.filter((_, i) => i !== idx) });
  }

  function addNetworkRole() {
    onChange({ networkRoles: [...person.networkRoles, createEmptyNetworkRoleDraft()] });
  }
  function updateNetworkRole(idx: number, patch: Partial<NetworkRoleDraft>) {
    onChange({ networkRoles: person.networkRoles.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  }
  function removeNetworkRole(idx: number) {
    onChange({ networkRoles: person.networkRoles.filter((_, i) => i !== idx) });
  }

  function addNetworkMembership() {
    onChange({ networkMemberships: [...person.networkMemberships, createEmptyNetworkMembershipDraft()] });
  }
  function updateNetworkMembership(idx: number, patch: Partial<NetworkMembershipDraft>) {
    onChange({ networkMemberships: person.networkMemberships.map((m, i) => (i === idx ? { ...m, ...patch } : m)) });
  }
  function removeNetworkMembership(idx: number) {
    onChange({ networkMemberships: person.networkMemberships.filter((_, i) => i !== idx) });
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {t("di.person.fullName")} #{index + 1}
          </h3>
          <button type="button" onClick={onRemove} className="text-xs text-critical hover:underline">
            {t("di.person.remove")}
          </button>
        </div>

        {person.existingPersonId ? (
          <div className="flex items-center justify-between rounded-lg border border-good/40 bg-good/5 px-3 py-2 text-sm">
            <span>
              {t("di.person.useExisting")}: <strong>{person.existingPersonLabel}</strong>
            </span>
            <button type="button" onClick={() => onChange({ existingPersonId: null, existingPersonLabel: null })} className="text-xs text-muted hover:text-foreground">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            {/* ── ข้อมูลบุคคล ─────────────────────────────────────────── */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">ข้อมูลบุคคล</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("di.person.fullName")} required>
                  <input
                    className={inputCls}
                    value={person.primaryFullName}
                    onChange={(e) => onChange({ primaryFullName: e.target.value })}
                    placeholder={t("di.hint.fullName")}
                  />
                </Field>
                <div className="space-y-1">
                  <Field label={t("di.person.nickname")}>
                    <input
                      className={inputCls}
                      value={person.nickname}
                      onChange={(e) => onChange({ nickname: e.target.value })}
                      placeholder={t("di.hint.nickname")}
                    />
                  </Field>
                  <HelperText>ชื่อเล่น — ไม่ควรใส่ไว้ในช่องชื่ออื่น</HelperText>
                </div>
                <Field label={t("di.person.nationality")}>
                  <Combobox value={person.nationality} onChange={(v) => onChange({ nationality: v })} suggestions={NATIONALITY_SUGGESTIONS} />
                </Field>
                <Field label={t("di.person.sex")}>
                  <Select options={sexOptions} value={person.sex} onChange={(e) => onChange({ sex: e.target.value })} />
                </Field>
                <Field label={t("di.person.dateOfBirth")}>
                  <ThaiDatePicker value={person.dateOfBirth} onChange={(v) => onChange({ dateOfBirth: v })} placeholder="DD/MM/YYYY" rejectFuture />
                </Field>
                {!person.dateOfBirth && (
                  <div className="space-y-1">
                    <Field label={t("di.person.approximateAge")}>
                      <input
                        className={inputCls}
                        value={person.approximateAge}
                        onChange={(e) => onChange({ approximateAge: e.target.value })}
                        inputMode="numeric"
                        placeholder={t("di.hint.approximateAge")}
                      />
                    </Field>
                    <HelperText>{t("di.hint.approximateAge")}</HelperText>
                  </div>
                )}
              </div>
            </section>

            {/* ── ชื่ออื่น / นามแฝง (aliases) ─────────────────────────── */}
            <section className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.aliasesSectionLabel")}</p>
              <HelperText>ชื่อที่ใช้แทนตัวตน เช่น แดง, บังหนึ่ง, เจ๊เอ — แยกออกจากชื่อเล่น</HelperText>
              <div className="mt-2 space-y-2">
                {person.aliases.map((alias, idx) => (
                  <div key={alias.key} className="flex items-center gap-2">
                    <input
                      className={inputCls + " flex-1"}
                      value={alias.fullName}
                      onChange={(e) => {
                        const updated = person.aliases.map((a, i) => (i === idx ? { ...a, fullName: e.target.value } : a));
                        onChange({ aliases: updated });
                      }}
                      placeholder={t("di.hint.alias")}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ aliases: person.aliases.filter((_, i) => i !== idx) })}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => onChange({ aliases: [...person.aliases, createEmptyAliasDraft()] })}>
                  + {t("di.person.addAlias")}
                </Button>
              </div>
            </section>

            {/* ── บทบาทในคดี (procedural) ──────────────────────────────── */}
            <section className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">บทบาทในคดี</p>
              <div className="max-w-xs">
                <Field label={t("di.person.role")} required>
                  <Select options={roleOptions} value={person.role} onChange={(e) => onChange({ role: e.target.value })} />
                </Field>
              </div>
            </section>

            {/* ── duplicate warning ──────────────────────────────────────── */}
            {showDuplicateWarning ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-serious">{t("di.person.duplicateWarningTitle")}</p>
                {duplicateCheck.candidates.map((candidate) => (
                  <DrugPersonMatchCard
                    key={candidate.personId}
                    candidate={candidate}
                    onUseExisting={() => onChange({ existingPersonId: candidate.personId, existingPersonLabel: candidate.primaryFullName })}
                  />
                ))}
                {duplicateCheck.candidates.some((c) => c.confidence === "HIGH") ? (
                  <ConfirmCreateNewDespiteStrongMatch onConfirm={duplicateCheck.dismiss} />
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={duplicateCheck.dismiss}>
                    {t("di.person.createNew")}
                  </Button>
                )}
              </div>
            ) : null}

            {/* ── บทบาทในเครือข่ายยาเสพติด (DI-7.3) ───────────────────── */}
            <section className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.networkRoles")}</p>
              <div className="space-y-3">
                {person.networkRoles.map((nr, idx) => (
                  <NetworkRoleRow
                    key={nr.key}
                    role={nr}
                    networkRoleOptions={networkRoleOptions}
                    sourceOptions={sourceOptions}
                    verificationOptions={verificationOptions}
                    onChange={(patch) => updateNetworkRole(idx, patch)}
                    onRemove={() => removeNetworkRole(idx)}
                  />
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addNetworkRole}>
                  {t("di.person.addNetworkRole")}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted">
                ต่างจาก &quot;บทบาทในคดี&quot; — นี่คือบทบาทในเครือข่ายยาเสพติดโดยรวม พร้อมระบุที่มาและสถานะการยืนยัน
              </p>
            </section>

            {/* ── เครือข่าย / กลุ่ม (DI-7.2) ───────────────────────────── */}
            <section className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.networkGroups")}</p>
              <div className="space-y-2">
                {person.networkMemberships.map((m, idx) => (
                  <NetworkMembershipRow
                    key={m.key}
                    membership={m}
                    onChange={(patch) => updateNetworkMembership(idx, patch)}
                    onRemove={() => removeNetworkMembership(idx)}
                  />
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addNetworkMembership}>
                  {t("di.person.addNetworkGroup")}
                </Button>
              </div>
            </section>

            {/* ── เอกสารประจำตัว ─────────────────────────────────────── */}
            <section className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium text-muted">{t("di.person.identifierType")}</p>
              {person.identifiers.map((identifier, idx) => (
                <div key={identifier.key} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Select options={identifierTypeOptions} value={identifier.type} onChange={(e) => updateIdentifier(idx, { type: e.target.value })} />
                  <input
                    className={inputCls}
                    placeholder={t("di.person.identifierValue")}
                    value={identifier.value}
                    onChange={(e) => updateIdentifier(idx, { value: e.target.value })}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeIdentifier(idx)}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addIdentifier}>
                + {t("di.person.identifierValue")}
              </Button>
            </section>

            {/* ── Advanced: phones/SIMs/devices/vehicles (progressive disclosure) ── */}
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showAdvanced ? "ซ่อนข้อมูลโทรศัพท์ / SIM / อุปกรณ์ / ยานพาหนะ" : "แสดงข้อมูลโทรศัพท์ / SIM / อุปกรณ์ / ยานพาหนะ"}
            </button>

            {showAdvanced && (
              <>
                <section className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.create.stepPhones")}</p>
                  {person.phones.map((phone, idx) => (
                    <PhoneRow key={phone.key} phone={phone} onChange={(patch) => updatePhone(idx, patch)} onRemove={() => removePhone(idx)} />
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                    {t("di.phone.addPhone")}
                  </Button>

                  {person.sims.map((sim, idx) => (
                    <SimRow key={sim.key} sim={sim} onChange={(patch) => updateSim(idx, patch)} onRemove={() => removeSim(idx)} />
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addSim}>
                    {t("di.sim.addSim")}
                  </Button>
                </section>

                <section className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.create.stepDevices")}</p>
                  {person.devices.map((device, idx) => (
                    <DeviceRow key={device.key} device={device} onChange={(patch) => updateDevice(idx, patch)} onRemove={() => removeDevice(idx)} />
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addDevice}>
                    {t("di.device.addDevice")}
                  </Button>
                </section>

                <section className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.create.stepVehicles")}</p>
                  {person.vehicles.map((vehicle, idx) => (
                    <VehicleRow key={vehicle.key} vehicle={vehicle} onChange={(patch) => updateVehicle(idx, patch)} onRemove={() => removeVehicle(idx)} />
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addVehicle}>
                    {t("di.vehicle.addVehicle")}
                  </Button>
                </section>
              </>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** DI-7.3: one network-role assertion row with provenance + verification. */
function NetworkRoleRow({
  role,
  networkRoleOptions,
  sourceOptions,
  verificationOptions,
  onChange,
  onRemove,
}: {
  role: NetworkRoleDraft;
  networkRoleOptions: { value: string; label: string }[];
  sourceOptions: { value: string; label: string }[];
  verificationOptions: { value: string; label: string }[];
  onChange: (patch: Partial<NetworkRoleDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label={t("di.networkRole.role")} required>
          <Select options={[{ value: "", label: t("common.pleaseSelect") }, ...networkRoleOptions]} value={role.role} onChange={(e) => onChange({ role: e.target.value })} />
        </Field>
        <Field label={t("di.networkRole.source")}>
          <Select options={sourceOptions} value={role.source} onChange={(e) => onChange({ source: e.target.value })} />
        </Field>
        <Field label={t("di.networkRole.verificationStatus")}>
          <Select options={verificationOptions} value={role.verificationStatus} onChange={(e) => onChange({ verificationStatus: e.target.value })} />
        </Field>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <Field label={t("di.networkRole.note")}>
            <input className={inputCls} value={role.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="เช่น ถูกซัดทอดจากพยาน A" />
          </Field>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {role.verificationStatus === "UNVERIFIED" && role.source === "TESTIMONY" && (
        <p className="mt-1 text-xs text-serious">ข้อมูลนี้ยังเป็น &quot;ถูกซัดทอด&quot; — ต้องการหลักฐานเพิ่มเติมเพื่อยืนยัน</p>
      )}
    </div>
  );
}

/** DI-7.2: one network/group membership row. */
function NetworkMembershipRow({
  membership,
  onChange,
  onRemove,
}: {
  membership: NetworkMembershipDraft;
  onChange: (patch: Partial<NetworkMembershipDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-2.5">
      <div className="flex-1">
        <input
          className={inputCls}
          value={membership.networkGroupName}
          onChange={(e) => onChange({ networkGroupName: e.target.value, networkGroupId: null })}
          placeholder={t("di.networkGroup.searchPlaceholder")}
        />
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Section 21/28: explicit confirmation gate before creating a new person despite a strong (HIGH-confidence) identifier collision. */
function ConfirmCreateNewDespiteStrongMatch({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        {t("di.person.createNew")}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-critical/40 bg-critical/5 p-3">
      <p className="text-sm text-critical">{t("di.error.duplicate")}</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onConfirm}>
          {t("di.person.createNew")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          {t("di.profile.cancel")}
        </Button>
      </div>
    </div>
  );
}

function PhoneRow({ phone, onChange, onRemove }: { phone: PhoneDraft; onChange: (patch: Partial<PhoneDraft>) => void; onRemove: () => void }) {
  const { t } = useT();
  const { user } = useAuth();
  const signal = usePhoneReuseSignal(user?.id ?? null, phone.rawInput);

  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Field label={t("di.phone.number")}>
          <input className={inputCls} value={phone.rawInput} onChange={(e) => onChange({ rawInput: e.target.value })} placeholder={t("di.hint.phone")} />
        </Field>
        <Field label={t("di.phone.firstSeen")}>
          <ThaiDatePicker value={phone.firstSeenAt} onChange={(v) => onChange({ firstSeenAt: v })} placeholder="DD/MM/YYYY" />
        </Field>
        <Field label={t("di.phone.lastSeen")}>
          <ThaiDatePicker value={phone.lastSeenAt} onChange={(v) => onChange({ lastSeenAt: v })} placeholder="DD/MM/YYYY" />
        </Field>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <DrugAlertInlineCard signal={signal} />
    </div>
  );
}

function SimRow({ sim, onChange, onRemove }: { sim: SimDraft; onChange: (patch: Partial<SimDraft>) => void; onRemove: () => void }) {
  const { t } = useT();
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-end">
        <Field label={t("di.sim.iccid")}>
          <input className={inputCls} value={sim.iccid} onChange={(e) => onChange({ iccid: e.target.value })} />
        </Field>
        <Field label={t("di.sim.imsi")}>
          <input className={inputCls} value={sim.imsi} onChange={(e) => onChange({ imsi: e.target.value })} />
        </Field>
        <Field label={t("di.sim.carrier")}>
          <input className={inputCls} value={sim.carrier} onChange={(e) => onChange({ carrier: e.target.value })} />
        </Field>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function DeviceRow({ device, onChange, onRemove }: { device: DeviceDraft; onChange: (patch: Partial<DeviceDraft>) => void; onRemove: () => void }) {
  const { t } = useT();
  const { user } = useAuth();
  const signal = useDeviceReuseSignal(user?.id ?? null, device.imei1, device.serialNumber);

  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("di.device.brand")}>
          <input className={inputCls} value={device.brand} onChange={(e) => onChange({ brand: e.target.value })} />
        </Field>
        <Field label={t("di.device.model")}>
          <input className={inputCls} value={device.model} onChange={(e) => onChange({ model: e.target.value })} />
        </Field>
        <Field label={t("di.device.serialNumber")}>
          <input className={inputCls} value={device.serialNumber} onChange={(e) => onChange({ serialNumber: e.target.value })} />
        </Field>
        <Field label={t("di.device.imei1")}>
          <input className={inputCls} value={device.imei1} onChange={(e) => onChange({ imei1: e.target.value })} inputMode="numeric" placeholder={t("di.hint.imei")} />
        </Field>
        <Field label={t("di.device.imei2")}>
          <input className={inputCls} value={device.imei2} onChange={(e) => onChange({ imei2: e.target.value })} inputMode="numeric" placeholder={t("di.hint.imei")} />
        </Field>
        <div className="flex items-end">
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <DrugAlertInlineCard signal={signal} />
    </div>
  );
}

function VehicleRow({ vehicle, onChange, onRemove }: { vehicle: VehicleDraft; onChange: (patch: Partial<VehicleDraft>) => void; onRemove: () => void }) {
  const { t } = useT();
  const { user } = useAuth();
  const signal = useVehicleReuseSignal(user?.id ?? null, vehicle.registrationNumber, vehicle.registrationProvince, vehicle.vin);
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("di.vehicle.registrationNumber")}>
          <input className={inputCls} value={vehicle.registrationNumber} onChange={(e) => onChange({ registrationNumber: e.target.value })} placeholder={t("di.hint.vehicle")} />
        </Field>
        <Field label={t("di.vehicle.registrationProvince")}>
          <input className={inputCls} value={vehicle.registrationProvince} onChange={(e) => onChange({ registrationProvince: e.target.value })} />
        </Field>
        <Field label={t("di.vehicle.type")}>
          <Combobox value={vehicle.vehicleType} onChange={(v) => onChange({ vehicleType: v })} suggestions={VEHICLE_TYPE_SUGGESTIONS} />
        </Field>
        <Field label={t("di.device.brand")}>
          <input className={inputCls} value={vehicle.brand} onChange={(e) => onChange({ brand: e.target.value })} />
        </Field>
        <Field label={t("di.vehicle.color")}>
          <input className={inputCls} value={vehicle.color} onChange={(e) => onChange({ color: e.target.value })} />
        </Field>
        <Field label={t("di.vehicle.vin")}>
          <input className={inputCls} value={vehicle.vin} onChange={(e) => onChange({ vin: e.target.value })} />
        </Field>
        <div className="flex items-end">
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <DrugAlertInlineCard signal={signal} />
    </div>
  );
}
