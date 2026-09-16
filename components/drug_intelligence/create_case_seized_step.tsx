/**
 * Create Case — Seized Items step.
 *
 * Visual hierarchy for field officers: what was seized, how much, which
 * unit, then optional packaging. COUNT / MASS stay distinct. VOLUME is not
 * in the persisted DrugMeasurementKind enum and is not invented here.
 * Canonical MASS storage remains grams (UI kilograms → grams at submit).
 */
"use client";

import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field, HelperText, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { createEmptySeizedItemDraft, type SeizedItemDraft, type ValidationError } from "@/lib/drug_intelligence/create_case_draft";
import { DRUG_CATEGORIES, DRUG_CATEGORY_LABELS, DRUG_MEASUREMENT_KINDS, DRUG_MEASUREMENT_KIND_LABELS, DRUG_CATEGORY_DEFAULT_MEASUREMENT_KIND, type DrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";
import { cn } from "@/lib/ui/cn";

const COUNT_UNIT_SUGGESTIONS = ["เม็ด", "แผง", "ลูก", "ชิ้น"];

const QUANTITY_INPUT_CLS = cn(inputCls, "text-lg font-semibold tracking-wide");

export function CreateCaseSeizedStep({
  items,
  onChange,
  errors = [],
}: {
  items: SeizedItemDraft[];
  onChange: (items: SeizedItemDraft[]) => void;
  errors?: ValidationError[];
}) {
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
    const current = items[index];
    const nextKind = current.measurementKind || defaultKind;
    const nextUnit = nextKind === "COUNT" && category === "METHAMPHETAMINE_TABLET" && !current.unit.trim() ? "เม็ด" : current.unit;
    update(index, { drugCategory: category, measurementKind: nextKind, unit: nextUnit });
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? <p className="text-sm text-muted">{t("di.seized.empty")}</p> : null}
      {items.map((item, index) => {
        const quantityError = errors.find((e) => e.field === `seized.${index}.quantity`)?.message;
        const categoryError = errors.find((e) => e.message.includes(`ของกลางลำดับที่ ${index + 1}`) && e.message.includes("ประเภทของกลาง"))?.message;
        const quantityLabel = item.measurementKind === "MASS" ? t("di.seized.massQuantity") : item.measurementKind === "VOLUME" ? t("di.seized.volumeQuantity") : t("di.seized.countQuantity");
        const quantityHint = item.measurementKind === "MASS" ? t("di.seized.massHint") : t("di.seized.countHint");
        return (
          <Card key={item.key}>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {t("di.seized.itemHeading")} #{index + 1}
                </p>
                <button type="button" onClick={() => remove(index)} className="text-xs text-critical hover:underline">
                  {t("di.person.remove")}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Field label={t("di.seized.drugCategory")} required error={categoryError}>
                    <Select options={categoryOptions} placeholder={t("common.pleaseSelect")} value={item.drugCategory} onChange={(e) => selectCategory(index, e.target.value)} />
                  </Field>
                  <HelperText>{t("di.seized.helperCategory")}</HelperText>
                </div>
                {item.drugCategory === "OTHER" ? (
                  <Field label={t("di.seized.otherDrugCategoryLabel")} required>
                    <input className={inputCls} value={item.otherDrugCategoryLabel} onChange={(e) => update(index, { otherDrugCategoryLabel: e.target.value })} />
                  </Field>
                ) : null}
                <div className="space-y-1">
                  <Field label={t("di.seized.measurementKind")} required>
                    <Select options={measurementKindOptions} placeholder={t("common.pleaseSelect")} value={item.measurementKind} onChange={(e) => update(index, { measurementKind: e.target.value })} />
                  </Field>
                  <HelperText>{t("di.seized.helperMeasure")}</HelperText>
                </div>
              </div>

              {item.measurementKind ? (
                <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t("di.seized.primaryQuantityHeading")}</p>
                  {item.measurementKind === "MASS" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <Field label={quantityLabel} required htmlFor={`di-seized-qty-${item.key}`} error={quantityError}>
                        <input
                          id={`di-seized-qty-${item.key}`}
                          className={QUANTITY_INPUT_CLS}
                          value={item.weightKilograms}
                          onChange={(e) => update(index, { weightKilograms: e.target.value })}
                          inputMode="decimal"
                          placeholder={t("di.seized.massExample")}
                        />
                      </Field>
                      <Field label={t("di.seized.unit")}>
                        <input className={inputCls} value="กิโลกรัม" readOnly aria-readonly="true" />
                      </Field>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <Field label={quantityLabel} required htmlFor={`di-seized-qty-${item.key}`} error={quantityError}>
                        <input
                          id={`di-seized-qty-${item.key}`}
                          className={QUANTITY_INPUT_CLS}
                          value={item.quantity}
                          onChange={(e) => update(index, { quantity: e.target.value })}
                          inputMode="decimal"
                          placeholder={t("di.seized.countExample")}
                        />
                      </Field>
                      <Field label={t("di.seized.unit")}>
                        <input className={inputCls} list={`unit-suggestions-${item.key}`} value={item.unit} onChange={(e) => update(index, { unit: e.target.value })} placeholder={t("di.seized.countUnitExample")} />
                        <datalist id={`unit-suggestions-${item.key}`}>
                          {COUNT_UNIT_SUGGESTIONS.map((u) => (
                            <option key={u} value={u} />
                          ))}
                        </datalist>
                      </Field>
                    </div>
                  )}
                  <HelperText>{quantityHint}</HelperText>
                </div>
              ) : (
                <p className="text-xs text-muted">{t("di.seized.selectMeasureFirst")}</p>
              )}

              <Field label={t("di.seized.drugType")} required htmlFor={`di-seized-type-${item.key}`}>
                <input
                  id={`di-seized-type-${item.key}`}
                  className={inputCls}
                  value={item.drugType}
                  onChange={(e) => update(index, { drugType: e.target.value })}
                  placeholder={t("di.hint.drugType")}
                />
                <HelperText>{t("di.seized.rawDescriptionHelper")}</HelperText>
              </Field>
              <Field label={t("di.seized.subtype")}>
                <input className={inputCls} value={item.subtype} onChange={(e) => update(index, { subtype: e.target.value })} placeholder={t("di.hint.drugSubtype")} />
              </Field>

              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted">{t("di.seized.packagingSection")}</p>
                <Field label={t("di.seized.packagingCount")}>
                  <input className={inputCls} value={item.packageCount} onChange={(e) => update(index, { packageCount: e.target.value })} inputMode="numeric" placeholder={t("di.hint.drugPackageCount")} />
                </Field>
                <HelperText>{t("di.seized.packagingHelper")}</HelperText>
              </div>
            </CardBody>
          </Card>
        );
      })}
      <Button type="button" variant="outline" onClick={add}>
        {t("di.seized.addItem")}
      </Button>
    </div>
  );
}
