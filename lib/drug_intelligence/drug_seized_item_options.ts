/**
 * DrugSeizedItem.drugCategory and .measurementKind options (Phase DI-3.1).
 *
 * Both true closed sets (real Postgres enums), mirroring
 * drug_person_options.ts / drug_location_options.ts's exact convention:
 * `[...] as const` + a bilingual label map + an `isValid*` type guard.
 *
 * `drugCategory` is the CANONICAL analytics key a future Commander
 * Dashboard (DI-8) aggregates by — never the free-text `drugType`/`unit`
 * fields, which remain evidence-as-recorded (see the schema doc comment on
 * DrugSeizedItem). `DRUG_CATEGORY_DEFAULT_MEASUREMENT_KIND` is a UX
 * convenience only (pre-selecting COUNT vs MASS when a user picks a
 * category) — it never substitutes for the user's own explicit choice, and
 * server-side validation (drug_case_api_schemas.ts) enforces the
 * COUNT/MASS ⇄ quantity/weightGrams pairing regardless of what the UI
 * defaulted to.
 *
 * Pure data — no I/O, no React.
 */

export const DRUG_CATEGORIES = [
  "METHAMPHETAMINE_TABLET",
  "CRYSTAL_METHAMPHETAMINE",
  "HEROIN",
  "KETAMINE",
  "MDMA",
  "COCAINE",
  "OPIUM",
  "CANNABIS",
  "OTHER",
] as const;
export type DrugCategory = (typeof DRUG_CATEGORIES)[number];

export const DRUG_CATEGORY_LABELS: Record<DrugCategory, { labelTh: string; labelEn: string }> = {
  METHAMPHETAMINE_TABLET: { labelTh: "ยาบ้า", labelEn: "Methamphetamine (Tablet)" },
  CRYSTAL_METHAMPHETAMINE: { labelTh: "ไอซ์", labelEn: "Crystal Methamphetamine" },
  HEROIN: { labelTh: "เฮโรอีน", labelEn: "Heroin" },
  KETAMINE: { labelTh: "เคตามีน", labelEn: "Ketamine" },
  MDMA: { labelTh: "ยาอี", labelEn: "MDMA" },
  COCAINE: { labelTh: "โคเคน", labelEn: "Cocaine" },
  OPIUM: { labelTh: "ฝิ่น", labelEn: "Opium" },
  CANNABIS: { labelTh: "กัญชา", labelEn: "Cannabis" },
  OTHER: { labelTh: "อื่น ๆ", labelEn: "Other" },
};

export function isValidDrugCategory(value: string): value is DrugCategory {
  return (DRUG_CATEGORIES as readonly string[]).includes(value);
}

export const DRUG_MEASUREMENT_KINDS = ["COUNT", "MASS"] as const;
export type DrugMeasurementKind = (typeof DRUG_MEASUREMENT_KINDS)[number];

export const DRUG_MEASUREMENT_KIND_LABELS: Record<DrugMeasurementKind, { labelTh: string; labelEn: string }> = {
  COUNT: { labelTh: "จำนวนนับ", labelEn: "Count" },
  MASS: { labelTh: "น้ำหนัก", labelEn: "Mass" },
};

export function isValidDrugMeasurementKind(value: string): value is DrugMeasurementKind {
  return (DRUG_MEASUREMENT_KINDS as readonly string[]).includes(value);
}

/**
 * UX default only — most tablet-form drugs are recorded by count, most
 * others by mass. The user can always override; server validation does not
 * depend on this mapping.
 */
export const DRUG_CATEGORY_DEFAULT_MEASUREMENT_KIND: Record<DrugCategory, DrugMeasurementKind> = {
  METHAMPHETAMINE_TABLET: "COUNT",
  CRYSTAL_METHAMPHETAMINE: "MASS",
  HEROIN: "MASS",
  KETAMINE: "MASS",
  MDMA: "COUNT",
  COCAINE: "MASS",
  OPIUM: "MASS",
  CANNABIS: "MASS",
  OTHER: "MASS",
};
