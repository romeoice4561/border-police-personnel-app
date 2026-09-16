/**
 * Create Case Step 4 — multi-category seized evidence.
 *
 * Drugs stay on DrugSeizedItem. Vehicles / devices / SIMs / phones reuse
 * canonical intelligence entities. Firearms and miscellaneous items are
 * bounded evidence rows only.
 */
"use client";

import { useState, type ReactNode } from "react";
import { Car, CreditCard, Crosshair, Package, Pill, Smartphone } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field, HelperText, inputCls } from "@/components/drug_intelligence/create_case_field";
import { CreateCaseSeizedStep } from "@/components/drug_intelligence/create_case_seized_step";
import { useT } from "@/components/i18n/language_provider";
import {
  isKnownSimCarrier,
  SIM_CARRIER_OTHER_SELECT,
  SIM_CARRIER_SELECT_OPTIONS,
  simCarrierSelectValue,
} from "@/lib/drug_intelligence/sim_carrier_options";
import {
  createEmptySeizedDeviceDraft,
  createEmptySeizedFirearmDraft,
  createEmptySeizedItemDraft,
  createEmptySeizedOtherDraft,
  createEmptySeizedSimDraft,
  createEmptySeizedVehicleDraft,
  type CreateCaseDraft,
  type SeizedDeviceDraft,
  type SeizedFirearmDraft,
  type SeizedOtherDraft,
  type SeizedSimDraft,
  type SeizedVehicleDraft,
  type ValidationError,
} from "@/lib/drug_intelligence/create_case_draft";
import { cn } from "@/lib/ui/cn";

const VEHICLE_TYPE_SUGGESTIONS = ["รถยนต์", "รถจักรยานยนต์", "รถกระบะ", "รถตู้"];
const FIREARM_TYPE_SUGGESTIONS = ["ปืนพก", "ปืนลูกซอง", "ปืนยาว", "อาวุธปืนอื่น"];

type EvidenceCategory = "drugs" | "vehicles" | "devices" | "sims" | "firearms" | "other";

export function CreateCaseEvidenceStep({
  draft,
  onChange,
  errors = [],
}: {
  draft: CreateCaseDraft;
  onChange: (patch: Partial<CreateCaseDraft>) => void;
  errors?: ValidationError[];
}) {
  const { t } = useT();

  function addCategory(category: EvidenceCategory) {
    if (category === "drugs") onChange({ seizedItems: [...draft.seizedItems, createEmptySeizedItemDraft()] });
    if (category === "vehicles") onChange({ seizedVehicles: [...draft.seizedVehicles, createEmptySeizedVehicleDraft()] });
    if (category === "devices") onChange({ seizedDevices: [...draft.seizedDevices, createEmptySeizedDeviceDraft()] });
    if (category === "sims") onChange({ seizedSims: [...draft.seizedSims, createEmptySeizedSimDraft()] });
    if (category === "firearms") onChange({ seizedFirearms: [...draft.seizedFirearms, createEmptySeizedFirearmDraft()] });
    if (category === "other") onChange({ seizedOtherItems: [...draft.seizedOtherItems, createEmptySeizedOtherDraft()] });
  }

  const categories: Array<{ key: EvidenceCategory; label: string; count: number; icon: typeof Pill }> = [
    { key: "drugs", label: t("di.seized.catDrugs"), count: draft.seizedItems.length, icon: Pill },
    { key: "vehicles", label: t("di.seized.catVehicles"), count: draft.seizedVehicles.length, icon: Car },
    { key: "devices", label: t("di.seized.catDevices"), count: draft.seizedDevices.length, icon: Smartphone },
    { key: "sims", label: t("di.seized.catSims"), count: draft.seizedSims.length, icon: CreditCard },
    { key: "firearms", label: t("di.seized.catFirearms"), count: draft.seizedFirearms.length, icon: Crosshair },
    { key: "other", label: t("di.seized.catOther"), count: draft.seizedOtherItems.length, icon: Package },
  ];

  const hasAny =
    draft.seizedItems.length +
      draft.seizedVehicles.length +
      draft.seizedDevices.length +
      draft.seizedSims.length +
      draft.seizedFirearms.length +
      draft.seizedOtherItems.length >
    0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-foreground">{t("di.seized.addCategory")}</p>
        <HelperText>{t("di.seized.intro")}</HelperText>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => addCategory(category.key)}
              className={cn(
                "flex min-h-14 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 text-left text-sm font-medium text-foreground",
                "hover:border-accent hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-accent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1 leading-tight">{category.label}</span>
              {category.count > 0 ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">{category.count}</span> : null}
            </button>
          );
        })}
      </div>

      {!hasAny ? <p className="text-sm text-muted">{t("di.seized.empty")}</p> : null}

      {draft.seizedItems.length > 0 ? (
        <EvidenceSection title={`${t("di.seized.catDrugs")} (${draft.seizedItems.length})`}>
          <CreateCaseSeizedStep items={draft.seizedItems} onChange={(seizedItems) => onChange({ seizedItems })} errors={errors} embedded />
        </EvidenceSection>
      ) : null}

      {draft.seizedVehicles.length > 0 ? (
        <EvidenceSection title={`${t("di.seized.catVehicles")} (${draft.seizedVehicles.length})`}>
          {draft.seizedVehicles.map((item, index) => (
            <VehicleCard
              key={item.key}
              item={item}
              index={index}
              error={errors.find((e) => e.field === `seizedVehicle.${index}`)?.message}
              onChange={(patch) => onChange({ seizedVehicles: draft.seizedVehicles.map((row, i) => (i === index ? { ...row, ...patch } : row)) })}
              onRemove={() => onChange({ seizedVehicles: draft.seizedVehicles.filter((_, i) => i !== index) })}
            />
          ))}
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => addCategory("vehicles")}>
            {t("di.seized.addVehicle")}
          </Button>
        </EvidenceSection>
      ) : null}

      {draft.seizedDevices.length > 0 ? (
        <EvidenceSection title={`${t("di.seized.catDevices")} (${draft.seizedDevices.length})`}>
          {draft.seizedDevices.map((item, index) => (
            <DeviceCard
              key={item.key}
              item={item}
              index={index}
              error={errors.find((e) => e.field === `seizedDevice.${index}`)?.message}
              onChange={(patch) => onChange({ seizedDevices: draft.seizedDevices.map((row, i) => (i === index ? { ...row, ...patch } : row)) })}
              onRemove={() => onChange({ seizedDevices: draft.seizedDevices.filter((_, i) => i !== index) })}
            />
          ))}
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => addCategory("devices")}>
            {t("di.seized.addDevice")}
          </Button>
        </EvidenceSection>
      ) : null}

      {draft.seizedSims.length > 0 ? (
        <EvidenceSection title={`${t("di.seized.catSims")} (${draft.seizedSims.length})`}>
          {draft.seizedSims.map((item, index) => (
            <SimCard
              key={item.key}
              item={item}
              index={index}
              error={errors.find((e) => e.field === `seizedSim.${index}`)?.message}
              onChange={(patch) => onChange({ seizedSims: draft.seizedSims.map((row, i) => (i === index ? { ...row, ...patch } : row)) })}
              onRemove={() => onChange({ seizedSims: draft.seizedSims.filter((_, i) => i !== index) })}
            />
          ))}
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => addCategory("sims")}>
            {t("di.seized.addSim")}
          </Button>
        </EvidenceSection>
      ) : null}

      {draft.seizedFirearms.length > 0 ? (
        <EvidenceSection title={`${t("di.seized.catFirearms")} (${draft.seizedFirearms.length})`}>
          {draft.seizedFirearms.map((item, index) => (
            <FirearmCard
              key={item.key}
              item={item}
              index={index}
              error={errors.find((e) => e.field === `seizedFirearm.${index}`)?.message}
              onChange={(patch) => onChange({ seizedFirearms: draft.seizedFirearms.map((row, i) => (i === index ? { ...row, ...patch } : row)) })}
              onRemove={() => onChange({ seizedFirearms: draft.seizedFirearms.filter((_, i) => i !== index) })}
            />
          ))}
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => addCategory("firearms")}>
            {t("di.seized.addFirearm")}
          </Button>
        </EvidenceSection>
      ) : null}

      {draft.seizedOtherItems.length > 0 ? (
        <EvidenceSection title={`${t("di.seized.catOther")} (${draft.seizedOtherItems.length})`}>
          {draft.seizedOtherItems.map((item, index) => (
            <OtherCard
              key={item.key}
              item={item}
              index={index}
              error={errors.find((e) => e.field === `seizedOther.${index}`)?.message}
              onChange={(patch) => onChange({ seizedOtherItems: draft.seizedOtherItems.map((row, i) => (i === index ? { ...row, ...patch } : row)) })}
              onRemove={() => onChange({ seizedOtherItems: draft.seizedOtherItems.filter((_, i) => i !== index) })}
            />
          ))}
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => addCategory("other")}>
            {t("di.seized.addOther")}
          </Button>
        </EvidenceSection>
      ) : null}
    </div>
  );
}

function EvidenceSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function ItemHeader({ title, onRemove }: { title: string; onRemove: () => void }) {
  const { t } = useT();
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <button type="button" onClick={onRemove} className="min-h-11 px-2 text-xs text-critical hover:underline">
        {t("di.person.remove")}
      </button>
    </div>
  );
}

function VehicleCard({
  item,
  index,
  error,
  onChange,
  onRemove,
}: {
  item: SeizedVehicleDraft;
  index: number;
  error?: string;
  onChange: (patch: Partial<SeizedVehicleDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  return (
    <Card>
      <CardBody className="space-y-3">
        <ItemHeader title={`${t("di.seized.catVehicles")} #${index + 1}`} onRemove={onRemove} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("di.vehicle.type")}>
            <input className={inputCls} list={`vehicle-type-${item.key}`} value={item.vehicleType} onChange={(e) => onChange({ vehicleType: e.target.value })} />
            <datalist id={`vehicle-type-${item.key}`}>
              {VEHICLE_TYPE_SUGGESTIONS.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </Field>
          <Field label={t("di.vehicle.registrationNumber")}>
            <input className={inputCls} value={item.registrationNumber} onChange={(e) => onChange({ registrationNumber: e.target.value })} />
          </Field>
          <Field label={t("di.vehicle.registrationProvince")}>
            <input className={inputCls} value={item.registrationProvince} onChange={(e) => onChange({ registrationProvince: e.target.value })} />
          </Field>
          <Field label={t("di.vehicle.vin")}>
            <input className={inputCls} value={item.vin} onChange={(e) => onChange({ vin: e.target.value })} />
          </Field>
          <Field label={t("di.device.brand")}>
            <input className={inputCls} value={item.brand} onChange={(e) => onChange({ brand: e.target.value })} />
          </Field>
          <Field label={t("di.device.model")}>
            <input className={inputCls} value={item.model} onChange={(e) => onChange({ model: e.target.value })} />
          </Field>
          <Field label={t("di.vehicle.color")}>
            <input className={inputCls} value={item.color} onChange={(e) => onChange({ color: e.target.value })} />
          </Field>
        </div>
        {error ? <p className="text-xs text-critical">{error}</p> : <HelperText>{t("di.seized.vehicleHelper")}</HelperText>}
        <Field label={t("di.seized.notes")}>
          <input className={inputCls} value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        </Field>
      </CardBody>
    </Card>
  );
}

function DeviceCard({
  item,
  index,
  error,
  onChange,
  onRemove,
}: {
  item: SeizedDeviceDraft;
  index: number;
  error?: string;
  onChange: (patch: Partial<SeizedDeviceDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  return (
    <Card>
      <CardBody className="space-y-3 overflow-x-hidden">
        <ItemHeader title={`${t("di.seized.catDevices")} #${index + 1}`} onRemove={onRemove} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Field label={t("di.device.brand")}>
              <input className={inputCls} value={item.brand} onChange={(e) => onChange({ brand: e.target.value })} />
            </Field>
          </div>
          <div className="min-w-0">
            <Field label={t("di.device.model")}>
              <input className={inputCls} value={item.model} onChange={(e) => onChange({ model: e.target.value })} />
            </Field>
          </div>
          <div className="min-w-0">
            <Field label={t("di.seized.imei1Label")}>
              <input
                className={inputCls}
                value={item.imei1}
                placeholder={t("di.seized.imei1Placeholder")}
                onChange={(e) => onChange({ imei1: e.target.value })}
                inputMode="numeric"
                autoComplete="off"
              />
              <HelperText>
                {t("di.seized.imei1Helper")} · {t("di.seized.imeiPlaceholderLength")}
              </HelperText>
            </Field>
          </div>
          <div className="min-w-0">
            <Field label={t("di.seized.imei2Label")}>
              <input
                className={inputCls}
                value={item.imei2}
                placeholder={t("di.seized.imei2Placeholder")}
                onChange={(e) => onChange({ imei2: e.target.value })}
                inputMode="numeric"
                autoComplete="off"
              />
              <HelperText>{t("di.seized.imeiPlaceholderLength")}</HelperText>
            </Field>
          </div>
          <div className="min-w-0">
            <Field label={t("di.seized.deviceSerialLabel")}>
              <input
                className={inputCls}
                value={item.serialNumber}
                placeholder={t("di.seized.deviceSerialPlaceholder")}
                onChange={(e) => onChange({ serialNumber: e.target.value })}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="min-w-0">
            <Field label={t("di.seized.associatedPhone")}>
              <input
                className={inputCls}
                value={item.associatedPhone}
                placeholder={t("di.seized.phonePlaceholder")}
                onChange={(e) => onChange({ associatedPhone: e.target.value })}
                inputMode="tel"
                autoComplete="off"
              />
              <HelperText>{t("di.seized.phoneWithDeviceHelper")}</HelperText>
            </Field>
          </div>
        </div>
        {error ? <p className="text-xs text-critical">{error}</p> : <HelperText>{t("di.seized.deviceHelper")}</HelperText>}
        <Field label={t("di.seized.notes")}>
          <input className={inputCls} value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        </Field>
      </CardBody>
    </Card>
  );
}

function SimCard({
  item,
  index,
  error,
  onChange,
  onRemove,
}: {
  item: SeizedSimDraft;
  index: number;
  error?: string;
  onChange: (patch: Partial<SeizedSimDraft>) => void;
  onRemove: () => void;
}) {
  const { t, language } = useT();
  const derivedSelect = simCarrierSelectValue(item.carrier);
  const [otherPicked, setOtherPicked] = useState(false);
  const selectValue = derivedSelect === SIM_CARRIER_OTHER_SELECT || otherPicked ? SIM_CARRIER_OTHER_SELECT : derivedSelect;
  const showCustomCarrier = selectValue === SIM_CARRIER_OTHER_SELECT;
  const carrierOptions = SIM_CARRIER_SELECT_OPTIONS.map((option) => ({
    value: option.value,
    label: language === "th" ? option.labelTh : option.labelEn,
  }));

  function onCarrierSelect(value: string) {
    if (value === SIM_CARRIER_OTHER_SELECT) {
      setOtherPicked(true);
      if (isKnownSimCarrier(item.carrier)) onChange({ carrier: "" });
      return;
    }
    setOtherPicked(false);
    onChange({ carrier: value });
  }

  return (
    <Card>
      <CardBody className="space-y-3 overflow-x-hidden">
        <ItemHeader title={`SIM #${index + 1}`} onRemove={onRemove} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Field label={t("di.seized.iccidLabel")}>
              <input
                className={inputCls}
                value={item.iccid}
                placeholder={t("di.seized.iccidPlaceholder")}
                onChange={(e) => onChange({ iccid: e.target.value })}
                inputMode="numeric"
                autoComplete="off"
              />
              <HelperText>
                {t("di.seized.iccidHelper")} · {t("di.seized.iccidLength")}
              </HelperText>
            </Field>
          </div>
          <div className="min-w-0">
            <Field label={t("di.seized.imsiLabel")}>
              <input
                className={inputCls}
                value={item.imsi}
                placeholder={t("di.seized.imsiPlaceholder")}
                onChange={(e) => onChange({ imsi: e.target.value })}
                inputMode="numeric"
                autoComplete="off"
              />
              <HelperText>
                {t("di.seized.imsiHelper")} · {t("di.seized.imsiLength")}
              </HelperText>
            </Field>
          </div>
          <div className="min-w-0">
            <Field label={t("di.seized.carrierLabel")}>
              <Select
                options={carrierOptions}
                placeholder={t("common.pleaseSelect")}
                value={selectValue}
                onChange={(e) => onCarrierSelect(e.target.value)}
              />
            </Field>
          </div>
          {showCustomCarrier ? (
            <div className="min-w-0">
              <Field label={t("di.seized.carrierOtherLabel")}>
                <input
                  className={inputCls}
                  value={isKnownSimCarrier(item.carrier) ? "" : item.carrier}
                  onChange={(e) => onChange({ carrier: e.target.value })}
                  autoComplete="off"
                />
              </Field>
            </div>
          ) : null}
          <div className={showCustomCarrier ? "min-w-0 sm:col-span-2" : "min-w-0"}>
            <Field label={t("di.seized.associatedPhone")}>
              <input
                className={inputCls}
                value={item.associatedPhone}
                placeholder={t("di.seized.phonePlaceholder")}
                onChange={(e) => onChange({ associatedPhone: e.target.value })}
                inputMode="tel"
                autoComplete="off"
              />
              <HelperText>{t("di.seized.phoneWithDeviceHelper")}</HelperText>
            </Field>
          </div>
        </div>
        {error ? <p className="text-xs text-critical">{error}</p> : <HelperText>{t("di.seized.simHelper")}</HelperText>}
        <Field label={t("di.seized.notes")}>
          <input className={inputCls} value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        </Field>
      </CardBody>
    </Card>
  );
}

function FirearmCard({
  item,
  index,
  error,
  onChange,
  onRemove,
}: {
  item: SeizedFirearmDraft;
  index: number;
  error?: string;
  onChange: (patch: Partial<SeizedFirearmDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  return (
    <Card>
      <CardBody className="space-y-3">
        <ItemHeader title={`${t("di.seized.catFirearms")} #${index + 1}`} onRemove={onRemove} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("di.seized.firearmType")} required error={error}>
            <input className={inputCls} list={`firearm-type-${item.key}`} value={item.firearmType} onChange={(e) => onChange({ firearmType: e.target.value })} />
            <datalist id={`firearm-type-${item.key}`}>
              {FIREARM_TYPE_SUGGESTIONS.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </Field>
          <Field label={t("di.device.brand")}>
            <input className={inputCls} value={item.brand} onChange={(e) => onChange({ brand: e.target.value })} />
          </Field>
          <Field label={t("di.device.model")}>
            <input className={inputCls} value={item.model} onChange={(e) => onChange({ model: e.target.value })} />
          </Field>
          <Field label={t("di.seized.serial")}>
            <input className={inputCls} value={item.serialNumber} onChange={(e) => onChange({ serialNumber: e.target.value })} />
          </Field>
          <Field label={t("di.seized.caliber")}>
            <input className={inputCls} value={item.caliberOrSize} onChange={(e) => onChange({ caliberOrSize: e.target.value })} />
          </Field>
          <Field label={t("di.seized.quantity")}>
            <input className={inputCls} value={item.quantity} onChange={(e) => onChange({ quantity: e.target.value })} inputMode="decimal" />
          </Field>
        </div>
        <Field label={t("di.seized.drugType")}>
          <input className={inputCls} value={item.recordedDescription} onChange={(e) => onChange({ recordedDescription: e.target.value })} />
        </Field>
        <Field label={t("di.seized.notes")}>
          <input className={inputCls} value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        </Field>
      </CardBody>
    </Card>
  );
}

function OtherCard({
  item,
  index,
  error,
  onChange,
  onRemove,
}: {
  item: SeizedOtherDraft;
  index: number;
  error?: string;
  onChange: (patch: Partial<SeizedOtherDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  return (
    <Card>
      <CardBody className="space-y-3">
        <ItemHeader title={`${t("di.seized.catOther")} #${index + 1}`} onRemove={onRemove} />
        <Field label={t("di.seized.otherName")} required error={error}>
          <input className={inputCls} value={item.label} onChange={(e) => onChange({ label: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("di.seized.quantity")}>
            <input className={inputCls} value={item.quantity} onChange={(e) => onChange({ quantity: e.target.value })} inputMode="decimal" />
          </Field>
          <Field label={t("di.seized.unit")}>
            <input className={inputCls} value={item.unit} onChange={(e) => onChange({ unit: e.target.value })} />
          </Field>
          <Field label={t("di.seized.serial")}>
            <input className={inputCls} value={item.serialNumber} onChange={(e) => onChange({ serialNumber: e.target.value })} />
          </Field>
        </div>
        <Field label={t("di.seized.drugType")}>
          <input className={inputCls} value={item.recordedDescription} onChange={(e) => onChange({ recordedDescription: e.target.value })} />
        </Field>
        <Field label={t("di.seized.notes")}>
          <input className={inputCls} value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        </Field>
      </CardBody>
    </Card>
  );
}
