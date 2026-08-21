/**
 * Create Case — Locations step (Phase DI-1 Round 2, Section 13).
 */
"use client";

import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Field, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_LOCATION_ROLES } from "@/lib/drug_intelligence/drug_location_options";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { createEmptyLocationDraft, type LocationDraft } from "@/lib/drug_intelligence/create_case_draft";

export function CreateCaseLocationsStep({ locations, onChange }: { locations: LocationDraft[]; onChange: (locations: LocationDraft[]) => void }) {
  const { t } = useT();
  const roleOptions = DRUG_LOCATION_ROLES.map((r) => ({ value: r, label: t(`di.locationRole.${r}`) }));

  function update(index: number, patch: Partial<LocationDraft>) {
    onChange(locations.map((loc, i) => (i === index ? { ...loc, ...patch } : loc)));
  }
  function remove(index: number) {
    onChange(locations.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...locations, createEmptyLocationDraft()]);
  }

  return (
    <div className="space-y-4">
      {locations.map((location, index) => (
        <Card key={location.key}>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {t("di.location.name")} #{index + 1}
              </p>
              <button type="button" onClick={() => remove(index)} className="text-xs text-critical hover:underline">
                {t("di.person.remove")}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("di.location.role")} required>
                <Select options={roleOptions} value={location.role} onChange={(e) => update(index, { role: e.target.value })} />
              </Field>
              <Field label={t("di.location.name")}>
                <input className={inputCls} value={location.name} onChange={(e) => update(index, { name: e.target.value })} />
              </Field>
              <Field label={t("di.location.address")}>
                <input className={inputCls} value={location.addressText} onChange={(e) => update(index, { addressText: e.target.value })} />
              </Field>
              <Field label={t("di.field.province")}>
                <Combobox value={location.province} onChange={(v) => update(index, { province: v })} suggestions={THAI_PROVINCE_OPTIONS} />
              </Field>
              <Field label={t("di.field.district")}>
                <input className={inputCls} value={location.district} onChange={(e) => update(index, { district: e.target.value })} />
              </Field>
              <Field label={t("di.field.subdistrict")}>
                <input className={inputCls} value={location.subdistrict} onChange={(e) => update(index, { subdistrict: e.target.value })} />
              </Field>
              <Field label={t("di.field.latitude")}>
                <input className={inputCls} value={location.latitude} onChange={(e) => update(index, { latitude: e.target.value })} inputMode="decimal" />
              </Field>
              <Field label={t("di.field.longitude")}>
                <input className={inputCls} value={location.longitude} onChange={(e) => update(index, { longitude: e.target.value })} inputMode="decimal" />
              </Field>
            </div>
          </CardBody>
        </Card>
      ))}
      <Button type="button" variant="outline" onClick={add}>
        {t("di.location.addLocation")}
      </Button>
    </div>
  );
}
