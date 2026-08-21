/**
 * Create Case — Seized Items step (Phase DI-1 Round 2, Section 12).
 * Never a fixed drugType1/drugType2 shape — arbitrary +/- rows.
 */
"use client";

import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { createEmptySeizedItemDraft, type SeizedItemDraft } from "@/lib/drug_intelligence/create_case_draft";

const DRUG_TYPE_SUGGESTIONS = ["ยาบ้า", "ไอซ์", "เฮโรอีน", "กัญชา", "เคตามีน", "ยาอี", "โคเคน"];
const UNIT_SUGGESTIONS = ["เม็ด", "กรัม", "กิโลกรัม", "ห่อ", "ถุง"];

export function CreateCaseSeizedStep({ items, onChange }: { items: SeizedItemDraft[]; onChange: (items: SeizedItemDraft[]) => void }) {
  const { t } = useT();

  function update(index: number, patch: Partial<SeizedItemDraft>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...items, createEmptySeizedItemDraft()]);
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <Card key={item.key}>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {t("di.seized.drugType")} #{index + 1}
              </p>
              <button type="button" onClick={() => remove(index)} className="text-xs text-critical hover:underline">
                {t("di.person.remove")}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("di.seized.drugType")} required>
                <Combobox value={item.drugType} onChange={(v) => update(index, { drugType: v })} suggestions={DRUG_TYPE_SUGGESTIONS} />
              </Field>
              <Field label={t("di.seized.subtype")}>
                <input className={inputCls} value={item.subtype} onChange={(e) => update(index, { subtype: e.target.value })} />
              </Field>
              <Field label={t("di.seized.quantity")}>
                <input className={inputCls} value={item.quantity} onChange={(e) => update(index, { quantity: e.target.value })} inputMode="decimal" />
              </Field>
              <Field label={t("di.seized.unit")}>
                <Combobox value={item.unit} onChange={(v) => update(index, { unit: v })} suggestions={UNIT_SUGGESTIONS} />
              </Field>
              <Field label={t("di.seized.weight")}>
                <input className={inputCls} value={item.weightGrams} onChange={(e) => update(index, { weightGrams: e.target.value })} inputMode="decimal" />
              </Field>
              <Field label={t("di.seized.packageCount")}>
                <input className={inputCls} value={item.packageCount} onChange={(e) => update(index, { packageCount: e.target.value })} inputMode="numeric" />
              </Field>
            </div>
          </CardBody>
        </Card>
      ))}
      <Button type="button" variant="outline" onClick={add}>
        {t("di.seized.addItem")}
      </Button>
    </div>
  );
}
