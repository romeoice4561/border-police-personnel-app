/**
 * DrugCasePerson.role and DrugPersonIdentifier.type options (Phase DI-1 —
 * Section 3/5).
 *
 * Both true closed sets (real Postgres enums) with bilingual labels.
 *
 * Pure data — no I/O, no React.
 */

export const DRUG_CASE_PERSON_ROLES = ["SUSPECT", "ACCUSED", "ARRESTED_PERSON", "ASSOCIATED_PERSON", "WITNESS", "OTHER"] as const;
export type DrugCasePersonRole = (typeof DRUG_CASE_PERSON_ROLES)[number];

export const DRUG_CASE_PERSON_ROLE_LABELS: Record<DrugCasePersonRole, { labelTh: string; labelEn: string }> = {
  SUSPECT: { labelTh: "ผู้ต้องสงสัย", labelEn: "Suspect" },
  ACCUSED: { labelTh: "ผู้ถูกกล่าวหา", labelEn: "Accused" },
  ARRESTED_PERSON: { labelTh: "ผู้ถูกจับกุม", labelEn: "Arrested Person" },
  ASSOCIATED_PERSON: { labelTh: "ผู้เกี่ยวข้อง", labelEn: "Associated Person" },
  WITNESS: { labelTh: "พยาน", labelEn: "Witness" },
  OTHER: { labelTh: "อื่น ๆ", labelEn: "Other" },
};

export function isValidDrugCasePersonRole(value: string): value is DrugCasePersonRole {
  return (DRUG_CASE_PERSON_ROLES as readonly string[]).includes(value);
}

export const DRUG_PERSON_IDENTIFIER_TYPES = ["THAI_ID", "PASSPORT", "ALIEN_ID", "OTHER", "UNKNOWN"] as const;
export type DrugPersonIdentifierType = (typeof DRUG_PERSON_IDENTIFIER_TYPES)[number];

export const DRUG_PERSON_IDENTIFIER_TYPE_LABELS: Record<DrugPersonIdentifierType, { labelTh: string; labelEn: string }> = {
  THAI_ID: { labelTh: "เลขบัตรประชาชน", labelEn: "Thai National ID" },
  PASSPORT: { labelTh: "หนังสือเดินทาง", labelEn: "Passport" },
  ALIEN_ID: { labelTh: "เลขประจำตัวคนต่างด้าว", labelEn: "Alien ID" },
  OTHER: { labelTh: "อื่น ๆ", labelEn: "Other" },
  UNKNOWN: { labelTh: "ยังไม่ทราบตัวตน", labelEn: "Unknown" },
};

export function isValidDrugPersonIdentifierType(value: string): value is DrugPersonIdentifierType {
  return (DRUG_PERSON_IDENTIFIER_TYPES as readonly string[]).includes(value);
}
