/**
 * DrugCaseLocation.role options (Phase DI-1 — Section 10).
 *
 * A closed set (real Postgres enum). Explicit roles only — never inferred
 * (Section 10's explicit prohibition on assuming shared location implies a
 * shared network).
 *
 * Pure data — no I/O, no React.
 */

export const DRUG_LOCATION_ROLES = ["ARREST_LOCATION", "RESIDENCE", "STORAGE_LOCATION", "MEETING_POINT", "OTHER"] as const;
export type DrugLocationRole = (typeof DRUG_LOCATION_ROLES)[number];

export const DRUG_LOCATION_ROLE_LABELS: Record<DrugLocationRole, { labelTh: string; labelEn: string }> = {
  ARREST_LOCATION: { labelTh: "สถานที่จับกุม", labelEn: "Arrest Location" },
  RESIDENCE: { labelTh: "ที่พักอาศัย", labelEn: "Residence" },
  STORAGE_LOCATION: { labelTh: "สถานที่เก็บของกลาง", labelEn: "Storage Location" },
  MEETING_POINT: { labelTh: "จุดนัดพบ", labelEn: "Meeting Point" },
  OTHER: { labelTh: "อื่น ๆ", labelEn: "Other" },
};

export function isValidDrugLocationRole(value: string): value is DrugLocationRole {
  return (DRUG_LOCATION_ROLES as readonly string[]).includes(value);
}
