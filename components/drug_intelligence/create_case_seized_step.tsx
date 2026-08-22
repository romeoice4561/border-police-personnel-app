/**
 * Create Case — Seized Items step (Phase DI-1 Round 2, Section 12; revised
 * Phase DI-3.1 Section 7).
 *
 * Never a fixed drugType1/drugType2 shape — arbitrary +/- rows.
 *
 * Phase DI-3.1: `drugCategory`/`measurementKind` are closed dropdowns (the
 * canonical analytics keys — Section 3/4), never free-text Combobox fields
 * anymore, so a future Commander Dashboard can aggregate without a
 * normalization pass. `drugType`/`subtype` remain free text — the
 * as-recorded evidence description, deliberately preserved verbatim
 * (Section 6). Selecting OTHER reveals a free-text substance-name field
 * that is NEVER itself the aggregation key. The measurement-kind choice
 * swaps the numeric field shown (quantity+unit for COUNT, kilograms for
 * MASS) so a user can never enter an ambiguous combination — mirrors
 * Section 4's explicit "avoid ambiguous combinations" instruction.
 */
"use client";

import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { createEmptySeizedItemDraft, type SeizedItemDraft } from "@/lib/drug_intelligence/create_case_draft";
import { DRUG_CATEGORIES, DRUG_CATEGORY_LABELS, DRUG_MEASUREMENT_KINDS, DRUG_MEASUREMENT_KIND_LABELS, DRUG_CATEGORY_DEFAULT_MEASUREMENT_KIND, type DrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";

const UNIT_SUGGESTIONS = ["เม็ด", "ห่อ", "ถุง", "แผง", "ลูก"];

export function CreateCaseSeizedStep({ items, onChange }: { items: SeizedItemDraft[]; onChange: (items: SeizedItemDraft[]) => void }) {
  const { t, language } = useT();

  const categoryOptions = DRUG_CATEGORIES.map((c) => ({ value: c, label: language === "th" ? DRUG_CATEGORY_LABELS[c].labelTh : DRUG_CATEGORY_LABELS[c].labelEn }));
  const measurementKindOptions = DRUG_MEASUREMENT_KINDS.map((k) => ({ value: k, label: language === "th" ? DRUG_MEASUREMENT_KIND_LABELS[k].labelTh : DRUG_MEASUREMENT_KIND_LABELS[k].labelEn }));

  function update(index: number, patch: Partial<SeizedItemDraft>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...items, createEmptySeizedItemDraft()]);
  }
  function selectCategory(index: number, category: string) {
    const isKnownCategory = (DRUG_CATEGORIES as readonly string[]).includes(category);
    const defaultKind = isKnownCategory ? DRUG_CATEGORY_DEFAULT_MEASUREMENT_KIND[category as DrugCategory] : "";
    update(index, { drugCategory: category, measurementKind: items[index].measurementKind || defaultKind });
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <Card key={item.key}>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {t("di.seized.drugCategory")} #{index + 1}
              </p>
              <button type="button" onClick={() => remove(index)} className="text-xs text-critical hover:underline">
                {t("di.person.remove")}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("di.seized.drugCategory")} required>
                <Select options={categoryOptions} placeholder={t("common.pleaseSelect")} value={item.drugCategory} onChange={(e) => selectCategory(index, e.target.value)} />
              </Field>
              {item.drugCategory === "OTHER" ? (
                <Field label={t("di.seized.otherDrugCategoryLabel")} required>
                  <input className={inputCls} value={item.otherDrugCategoryLabel} onChange={(e) => update(index, { otherDrugCategoryLabel: e.target.value })} />
                </Field>
              ) : null}
              <Field label={t("di.seized.measurementKind")} required>
                <Select options={measurementKindOptions} placeholder={t("common.pleaseSelect")} value={item.measurementKind} onChange={(e) => update(index, { measurementKind: e.target.value })} />
              </Field>
              <Field label={t("di.seized.drugType")} required>
                <input className={inputCls} value={item.drugType} onChange={(e) => update(index, { drugType: e.target.value })} />
              </Field>
              <Field label={t("di.seized.subtype")}>
                <input className={inputCls} value={item.subtype} onChange={(e) => update(index, { subtype: e.target.value })} />
              </Field>
              {item.measurementKind === "MASS" ? (
                <Field label={t("di.seized.weightKilograms")}>
                  <input className={inputCls} value={item.weightKilograms} onChange={(e) => update(index, { weightKilograms: e.target.value })} inputMode="decimal" />
                </Field>
              ) : (
                <>
                  <Field label={t("di.seized.quantity")}>
                    <input className={inputCls} value={item.quantity} onChange={(e) => update(index, { quantity: e.target.value })} inputMode="decimal" />
                  </Field>
                  <Field label={t("di.seized.unit")}>
                    <input className={inputCls} list={`unit-suggestions-${item.key}`} value={item.unit} onChange={(e) => update(index, { unit: e.target.value })} />
                    <datalist id={`unit-suggestions-${item.key}`}>
                      {UNIT_SUGGESTIONS.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </Field>
                </>
              )}
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
