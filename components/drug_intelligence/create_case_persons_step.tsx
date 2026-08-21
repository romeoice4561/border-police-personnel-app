/**
 * Create Case — Persons step (Phase DI-1 Round 2, Section 8/9/10/11 combined
 * — one card per person carrying their phones/SIMs/devices/vehicles, since
 * those all belong TO a specific person WITHIN this case, per the schema's
 * DrugCasePerson-scoped design).
 */
"use client";

import { AlertTriangle, X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { Field, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import { useDrugPersonDuplicateCheck } from "@/components/drug_intelligence/use_person_duplicate_check";
import { usePhoneExistsIndicator, useDeviceExistsIndicator } from "@/components/drug_intelligence/use_reuse_indicators";
import { DRUG_CASE_PERSON_ROLES } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_PERSON_IDENTIFIER_TYPES } from "@/lib/drug_intelligence/drug_person_options";
import {
  createEmptyPersonDraft,
  nextDraftKey,
  type PersonDraft,
  type PhoneDraft,
  type SimDraft,
  type DeviceDraft,
  type VehicleDraft,
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
  const { t } = useT();
  const { user } = useAuth();
  const roleOptions = DRUG_CASE_PERSON_ROLES.map((r) => ({ value: r, label: t(`di.role.${r}`) }));
  const identifierTypeOptions = DRUG_PERSON_IDENTIFIER_TYPES.map((it) => ({ value: it, label: t(`di.identifierType.${it}`) }));

  const duplicateCheck = useDrugPersonDuplicateCheck(user?.id ?? null, {
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("di.person.fullName")} required>
                <input className={inputCls} value={person.primaryFullName} onChange={(e) => onChange({ primaryFullName: e.target.value })} />
              </Field>
              <Field label={t("di.person.nationality")}>
                <Combobox value={person.nationality} onChange={(v) => onChange({ nationality: v })} suggestions={NATIONALITY_SUGGESTIONS} />
              </Field>
              <Field label={t("di.person.dateOfBirth")}>
                <ThaiDatePicker value={person.dateOfBirth} onChange={(v) => onChange({ dateOfBirth: v })} placeholder="DD/MM/YYYY" rejectFuture />
              </Field>
              <Field label={t("di.person.role")} required>
                <Select options={roleOptions} value={person.role} onChange={(e) => onChange({ role: e.target.value })} />
              </Field>
            </div>

            {showDuplicateWarning ? (
              <div className="space-y-2 rounded-lg border border-serious/40 bg-serious/5 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-serious">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t("di.person.duplicateWarningTitle")}
                </p>
                <ul className="space-y-1.5">
                  {duplicateCheck.candidates.map((candidate) => (
                    <li key={candidate.personId} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                      <span className="truncate">{candidate.primaryFullName}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onChange({ existingPersonId: candidate.personId, existingPersonLabel: candidate.primaryFullName })}
                      >
                        {t("di.person.useExisting")}
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button type="button" variant="ghost" size="sm" onClick={duplicateCheck.dismiss}>
                  {t("di.person.createNew")}
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted">{t("di.person.identifierType")}</p>
              {person.identifiers.map((identifier, idx) => (
                <div key={identifier.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
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
            </div>
          </>
        )}

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
      </CardBody>
    </Card>
  );
}

function PhoneRow({ phone, onChange, onRemove }: { phone: PhoneDraft; onChange: (patch: Partial<PhoneDraft>) => void; onRemove: () => void }) {
  const { t } = useT();
  const { user } = useAuth();
  const exists = usePhoneExistsIndicator(user?.id ?? null, phone.rawInput);

  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Field label={t("di.phone.number")}>
          <input className={inputCls} value={phone.rawInput} onChange={(e) => onChange({ rawInput: e.target.value })} placeholder="081-234-5678" />
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
      {exists ? <p className="mt-1.5 text-xs text-warning">{t("di.phone.existsWarning")}</p> : null}
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
  const exists = useDeviceExistsIndicator(user?.id ?? null, device.imei1, device.serialNumber);

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
          <input className={inputCls} value={device.imei1} onChange={(e) => onChange({ imei1: e.target.value })} inputMode="numeric" />
        </Field>
        <Field label={t("di.device.imei2")}>
          <input className={inputCls} value={device.imei2} onChange={(e) => onChange({ imei2: e.target.value })} inputMode="numeric" />
        </Field>
        <div className="flex items-end">
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {exists ? <p className="mt-1.5 text-xs text-warning">{t("di.device.existsWarning")}</p> : null}
    </div>
  );
}

function VehicleRow({ vehicle, onChange, onRemove }: { vehicle: VehicleDraft; onChange: (patch: Partial<VehicleDraft>) => void; onRemove: () => void }) {
  const { t } = useT();
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("di.vehicle.registrationNumber")}>
          <input className={inputCls} value={vehicle.registrationNumber} onChange={(e) => onChange({ registrationNumber: e.target.value })} />
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
    </div>
  );
}
